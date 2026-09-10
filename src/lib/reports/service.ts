import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { toCsv } from "@/lib/csv";
import { addMonths, monthRange, monthlyBudgetFor, planMonthIndex, yearMonthOf } from "@/lib/expenses/budget";
import { CHANNEL_LABELS } from "@/lib/sales/channel";
import { PAYMENT_METHOD_LABELS } from "@/lib/expenses/labels";
import type { SalesChannel } from "@/generated/prisma/client";

export type MonthReport = {
  month: string;
  planMonth: number;
  sales: { channel: SalesChannel; label: string; orders: number; netCents: number }[];
  salesNetCents: number;
  salesOrders: number;
  salesUnits: number;
  costOfSalesCents: number;
  marginCents: number;
  expenses: { category: string; group: "opening" | "recurring"; cents: number; budgetCents: number }[];
  expensesCents: number;
  expensesBudgetCents: number;
  payrollCents: number;
  payrollBudgetCents: number;
  payablesPaidCents: number;
  purchasesCents: number;
  resultCents: number;
  cashFlowCents: number;
};

/** Reporte de un mes: ventas por canal, margen, gastos por categoría, nómina, resultado. */
export async function monthReport(month: string): Promise<MonthReport> {
  const s = await getSettings();
  const { start, end } = monthRange(month);
  const [orders, expenses, cats, periods, payables, purchases] = await Promise.all([
    prisma.order.findMany({ where: { placedAt: { gte: start, lt: end }, cancelledAt: null }, include: { items: true } }),
    prisma.expense.findMany({ where: { date: { gte: start, lt: end } }, include: { category: true } }),
    prisma.expenseCategory.findMany({ where: { active: true }, orderBy: { sort: "asc" } }),
    prisma.payPeriod.findMany({ where: { startsOn: { gte: start, lt: end }, status: { not: "open" } }, include: { lines: true } }),
    prisma.payable.findMany({ where: { paidOn: { gte: start, lt: end } } }),
    prisma.purchase.findMany({ where: { date: { gte: start, lt: end }, status: { not: "draft" } } }),
  ]);
  const byChannel = new Map<SalesChannel, { orders: number; netCents: number }>();
  let costOfSales = 0, units = 0;
  for (const o of orders) {
    const c = byChannel.get(o.channel) ?? { orders: 0, netCents: 0 };
    c.orders++; c.netCents += o.totalCents - o.refundedCents; byChannel.set(o.channel, c);
    for (const i of o.items) { const q = i.qty - i.refundedQty; units += q; costOfSales += (i.costCentsAtSale ?? 0) * q; }
  }
  const salesNetCents = Array.from(byChannel.values()).reduce((a, c) => a + c.netCents, 0);
  const spentByCat = new Map<string, number>();
  for (const e of expenses) spentByCat.set(e.categoryId, (spentByCat.get(e.categoryId) ?? 0) + e.amountCents);
  const expenseRows = cats
    .map((c) => ({ category: c.name, group: c.group, cents: spentByCat.get(c.id) ?? 0, budgetCents: c.group === "recurring" ? monthlyBudgetFor(c, month, s.apertura_mes) : 0 }))
    .filter((r) => r.cents > 0 || r.budgetCents > 0);
  // La nómina como gasto viene de los períodos cerrados, no de la categoría "Nómina" (para no duplicar).
  const payrollCents = periods.reduce((a, p) => a + p.lines.reduce((b, l) => b + l.grossCents, 0), 0);
  const nominaCat = cats.find((c) => c.name === "Nómina");
  const payrollBudgetCents = nominaCat ? monthlyBudgetFor(nominaCat, month, s.apertura_mes) : 0;
  const expensesNoPayroll = expenseRows.filter((r) => r.category !== "Nómina");
  const expensesCents = expensesNoPayroll.reduce((a, r) => a + r.cents, 0);
  const expensesBudgetCents = expensesNoPayroll.reduce((a, r) => a + r.budgetCents, 0);
  const payablesPaidCents = payables.reduce((a, p) => a + p.amountCents, 0);
  const purchasesCents = purchases.reduce((a, p) => a + p.totalCents, 0);
  const marginCents = salesNetCents - costOfSales;
  return {
    month, planMonth: planMonthIndex(month, s.apertura_mes),
    sales: Array.from(byChannel, ([channel, v]) => ({ channel, label: CHANNEL_LABELS[channel], ...v })).sort((a, b) => b.netCents - a.netCents),
    salesNetCents, salesOrders: orders.length, salesUnits: units, costOfSalesCents: costOfSales, marginCents,
    expenses: expensesNoPayroll, expensesCents, expensesBudgetCents, payrollCents, payrollBudgetCents, payablesPaidCents, purchasesCents,
    // Resultado económico: margen − gastos − nómina. Caja: ventas cobradas − gastos − nómina − pagos a proveedores.
    resultCents: marginCents - expensesCents - payrollCents,
    cashFlowCents: salesNetCents - expensesCents - payrollCents - payablesPaidCents,
  };
}

export type StopRuleRow = { monthIndex: number; month: string; targetCents: number; flowCents: number; cashCents: number; deltaCents: number; status: "ok" | "warn" | "red" | "future" };

/**
 * Regla de parada: caja real acumulada (caja inicial + caja de cada mes) vs objetivo.
 * Cuatro consultas para los 12 meses y el reparto por mes se hace en memoria; antes
 * era un reporte completo por mes (más de 70 consultas) y hacía lenta la pantalla.
 */
export async function stopRule(): Promise<{ rows: StopRuleRow[]; thresholdCents: number; initialCents: number; openingMonth: string }> {
  const s = await getSettings();
  const now = yearMonthOf(new Date(), s.tienda_timezone);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(s.apertura_mes, i));
  const from = monthRange(months[0]).start;
  const to = monthRange(months[11]).end;
  const monthOf = (d: Date) => d.toISOString().slice(0, 7);
  const add = (m: Map<string, number>, key: string, n: number) => m.set(key, (m.get(key) ?? 0) + n);

  const [targets, orders, expenses, periods, payables] = await Promise.all([
    prisma.cashTarget.findMany({ orderBy: { monthIndex: "asc" } }),
    prisma.order.findMany({ where: { placedAt: { gte: from, lt: to }, cancelledAt: null }, select: { placedAt: true, totalCents: true, refundedCents: true } }),
    prisma.expense.findMany({ where: { date: { gte: from, lt: to } }, select: { date: true, amountCents: true, category: { select: { name: true } } } }),
    prisma.payPeriod.findMany({ where: { startsOn: { gte: from, lt: to }, status: { not: "open" } }, select: { startsOn: true, lines: { select: { grossCents: true } } } }),
    prisma.payable.findMany({ where: { paidOn: { gte: from, lt: to } }, select: { paidOn: true, amountCents: true } }),
  ]);

  const sales = new Map<string, number>(), spent = new Map<string, number>(), payroll = new Map<string, number>(), paid = new Map<string, number>();
  for (const o of orders) add(sales, monthOf(o.placedAt), o.totalCents - o.refundedCents);
  // La nómina entra por los períodos cerrados; la categoría "Nómina" se excluye para no contarla dos veces.
  for (const e of expenses) if (e.category.name !== "Nómina") add(spent, monthOf(e.date), e.amountCents);
  for (const p of periods) add(payroll, monthOf(p.startsOn), p.lines.reduce((a, l) => a + l.grossCents, 0));
  for (const p of payables) if (p.paidOn) add(paid, monthOf(p.paidOn), p.amountCents);

  let cash = s.caja_inicial;
  const rows: StopRuleRow[] = months.map((month, idx) => {
    const i = idx + 1;
    const target = targets.find((t) => t.monthIndex === i)?.targetCents ?? 0;
    if (month > now) return { monthIndex: i, month, targetCents: target, flowCents: 0, cashCents: cash, deltaCents: cash - target, status: "future" as const };
    const flowCents = (sales.get(month) ?? 0) - (spent.get(month) ?? 0) - (payroll.get(month) ?? 0) - (paid.get(month) ?? 0);
    cash += flowCents;
    const delta = cash - target;
    return { monthIndex: i, month, targetCents: target, flowCents, cashCents: cash, deltaCents: delta, status: delta < -s.regla_parada_umbral ? "red" : delta < 0 ? "warn" : "ok" };
  });
  return { rows, thresholdCents: s.regla_parada_umbral, initialCents: s.caja_inicial, openingMonth: s.apertura_mes };
}

export async function setCashTarget(monthIndex: number, targetCents: number) {
  const before = await prisma.cashTarget.findUnique({ where: { monthIndex } });
  await prisma.cashTarget.upsert({ where: { monthIndex }, create: { monthIndex, targetCents }, update: { targetCents } });
  await audit("cash_targets", monthIndex, before ? { targetCents: before.targetCents } : null, { targetCents });
}

/** Stock actual en piezas, gramos, costo y precio al público. */
export async function stockSnapshot() {
  const stock = await prisma.stockMovement.groupBy({ by: ["productId"], _sum: { qty: true } });
  const ids = stock.filter((x) => (x._sum.qty ?? 0) > 0).map((x) => x.productId);
  const products = ids.length ? await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, grams: true, costCents: true, priceCents: true } }) : [];
  const q = new Map(stock.map((x) => [x.productId, x._sum.qty ?? 0]));
  let pieces = 0, grams = 0, costCents = 0, priceCents = 0;
  for (const p of products) { const n = q.get(p.id) ?? 0; pieces += n; grams += Number(p.grams) * n; costCents += p.costCents * n; priceCents += p.priceCents * n; }
  return { pieces, grams: Math.round(grams * 100) / 100, costCents, priceCents };
}

// ---------------------------------------------------------------------------
// Export contable
// ---------------------------------------------------------------------------

export async function salesCsv(from: Date, to: Date) {
  const orders = await prisma.order.findMany({ where: { placedAt: { gte: from, lt: to } }, include: { items: true }, orderBy: { placedAt: "asc" } });
  const rows: (string | number)[][] = [];
  for (const o of orders) for (const i of o.items) rows.push([
    o.placedAt.toISOString().slice(0, 10), o.orderNumber, CHANNEL_LABELS[o.channel], o.customerName ?? "", o.staffName ?? "", i.sku ?? "", i.title, i.qty, i.refundedQty,
    (i.priceCents / 100).toFixed(2), (i.discountCents / 100).toFixed(2), i.costCentsAtSale != null ? (i.costCentsAtSale / 100).toFixed(2) : "", i.gramsAtSale != null ? Number(i.gramsAtSale).toFixed(2) : "",
    (o.taxCents / 100).toFixed(2), (o.totalCents / 100).toFixed(2), (o.refundedCents / 100).toFixed(2), o.paymentGateway ?? "", o.financialStatus ?? "", o.cancelledAt ? "cancelada" : "",
  ]);
  return toCsv(["Fecha", "Orden", "Canal", "Cliente", "Vendedora", "SKU", "Producto", "Cant.", "Devuelto", "Precio unit.", "Descuento línea", "Costo unit.", "Gramos", "Impuestos orden", "Total orden", "Devuelto orden", "Pago", "Estado", "Cancelada"], rows, { bom: true });
}

export async function payrollCsv(from: Date, to: Date) {
  const periods = await prisma.payPeriod.findMany({ where: { startsOn: { gte: from, lt: to }, status: { not: "open" } }, include: { lines: { include: { employee: true } } }, orderBy: { startsOn: "asc" } });
  const rows: (string | number)[][] = [];
  for (const p of periods) for (const l of p.lines) rows.push([p.startsOn.toISOString().slice(0, 10), p.endsOn.toISOString().slice(0, 10), p.status, l.employee.name, Number(l.regularHours).toFixed(2), Number(l.overtimeHours).toFixed(2), (l.rateCents / 100).toFixed(2), (l.grossCents / 100).toFixed(2)]);
  return toCsv(["Inicio", "Fin", "Estado", "Empleada", "Horas normales", "Horas extra", "Tarifa", "Bruto"], rows, { bom: true });
}

export { PAYMENT_METHOD_LABELS };
