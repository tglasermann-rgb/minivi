import "server-only";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { signedUrl, uploadToBucket } from "@/lib/storage";
import { toCsv } from "@/lib/csv";
import type { ExpenseFrequency, PaymentMethod, Prisma } from "@/generated/prisma/client";
import { PAYMENT_METHOD_LABELS } from "./labels";
import { addMonths, monthRange, monthlyBudgetFor, yearMonthOf } from "./budget";

export const RECEIPTS_BUCKET = "receipts";

export type ExpenseInput = {
  date: Date;
  categoryId: string;
  vendor: string;
  amountCents: number;
  paymentMethod: PaymentMethod;
  recurring: boolean;
  frequency?: ExpenseFrequency | null;
  notes?: string | null;
  paid: boolean;
  reimbursable: boolean;
  receipt?: { bytes: Buffer; contentType: string; name: string } | null;
};

async function storeReceipt(expenseId: string, r: NonNullable<ExpenseInput["receipt"]>): Promise<string> {
  const ext = (r.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${expenseId}/${Date.now()}.${ext}`;
  await uploadToBucket(RECEIPTS_BUCKET, path, r.bytes, r.contentType, false);
  return path;
}

export async function createExpense(input: ExpenseInput) {
  const user = await getCurrentUser();
  const reimbursable = input.reimbursable || input.paymentMethod.startsWith("personal_card");
  const e = await prisma.expense.create({
    data: {
      date: input.date, categoryId: input.categoryId, vendor: input.vendor.trim(), amountCents: input.amountCents, paymentMethod: input.paymentMethod,
      recurring: input.recurring, frequency: input.recurring ? input.frequency ?? "monthly" : null, notes: input.notes ?? null, paid: input.paid, reimbursable, createdBy: user?.id ?? null,
    },
  });
  if (input.receipt) {
    const receiptPath = await storeReceipt(e.id, input.receipt);
    await prisma.expense.update({ where: { id: e.id }, data: { receiptPath } });
  }
  await audit("expenses", e.id, null, { vendor: e.vendor, amountCents: e.amountCents, categoryId: e.categoryId, date: e.date.toISOString().slice(0, 10) });
  return e;
}

export async function updateExpense(id: string, input: Partial<ExpenseInput>) {
  const before = await prisma.expense.findUniqueOrThrow({ where: { id } });
  const data: Prisma.ExpenseUpdateInput = {};
  if (input.date) data.date = input.date;
  if (input.categoryId) data.category = { connect: { id: input.categoryId } };
  if (input.vendor != null) data.vendor = input.vendor.trim();
  if (input.amountCents != null) data.amountCents = input.amountCents;
  if (input.paymentMethod) data.paymentMethod = input.paymentMethod;
  if (input.recurring != null) { data.recurring = input.recurring; data.frequency = input.recurring ? input.frequency ?? "monthly" : null; }
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.paid != null) data.paid = input.paid;
  if (input.reimbursable != null) data.reimbursable = input.reimbursable;
  if (input.receipt) data.receiptPath = await storeReceipt(id, input.receipt);
  const after = await prisma.expense.update({ where: { id }, data });
  await audit("expenses", id, { vendor: before.vendor, amountCents: before.amountCents, paid: before.paid, reimbursable: before.reimbursable }, { vendor: after.vendor, amountCents: after.amountCents, paid: after.paid, reimbursable: after.reimbursable });
  return after;
}

export async function markReimbursed(id: string, on: Date | null) {
  const before = await prisma.expense.findUniqueOrThrow({ where: { id } });
  const after = await prisma.expense.update({ where: { id }, data: { reimbursedOn: on } });
  await audit("expenses", id, { reimbursedOn: before.reimbursedOn }, { reimbursedOn: after.reimbursedOn });
  return after;
}

export async function receiptUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  return signedUrl(RECEIPTS_BUCKET, path, 3600).catch(() => null);
}

/** Gastos de un mes (YYYY-MM) con categoría. */
export async function listExpensesByMonth(yearMonth: string) {
  const { start, end } = monthRange(yearMonth);
  return prisma.expense.findMany({ where: { date: { gte: start, lt: end } }, include: { category: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
}

export async function listCategories() {
  return prisma.expenseCategory.findMany({ where: { active: true }, orderBy: [{ group: "asc" }, { sort: "asc" }] });
}

/** Vista Apertura: por grupo de presupuesto, gastado vs presupuesto. Inventario = total de compras. */
export async function openingSummary() {
  const [budgets, cats, purchases] = await Promise.all([
    prisma.openingBudget.findMany({ orderBy: { amountCents: "desc" } }),
    prisma.expenseCategory.findMany({ where: { group: "opening" }, include: { expenses: { select: { amountCents: true } } }, orderBy: { sort: "asc" } }),
    prisma.purchase.aggregate({ _sum: { totalCents: true }, where: { status: { not: "draft" } } }),
  ]);
  const spentByGroup = new Map<string, number>();
  const catsByGroup = new Map<string, { name: string; spentCents: number }[]>();
  for (const c of cats) {
    const g = c.budgetGroup ?? c.name;
    const spent = c.expenses.reduce((s, e) => s + e.amountCents, 0);
    spentByGroup.set(g, (spentByGroup.get(g) ?? 0) + spent);
    catsByGroup.set(g, [...(catsByGroup.get(g) ?? []), { name: c.name, spentCents: spent }]);
  }
  spentByGroup.set("Inventario", purchases._sum.totalCents ?? 0);
  const groups = new Set([...budgets.map((b) => b.group), ...spentByGroup.keys()]);
  const rows = Array.from(groups).map((g) => ({
    group: g,
    budgetCents: budgets.find((b) => b.group === g)?.amountCents ?? 0,
    spentCents: spentByGroup.get(g) ?? 0,
    categories: catsByGroup.get(g) ?? [],
  })).sort((a, b) => b.budgetCents - a.budgetCents);
  const totalBudget = rows.reduce((s, r) => s + r.budgetCents, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spentCents, 0);
  return { rows, totalBudget, totalSpent };
}

/** Vista Mensual: matriz categoría × últimos N meses con presupuesto por celda. */
export async function monthlyMatrix(months = 6, endMonth?: string) {
  const settings = await getSettings();
  const last = endMonth ?? yearMonthOf(new Date(), settings.tienda_timezone);
  const list = Array.from({ length: months }, (_, i) => addMonths(last, i - (months - 1)));
  const { start } = monthRange(list[0]);
  const { end } = monthRange(list[list.length - 1]);
  const [cats, expenses, overrides] = await Promise.all([
    prisma.expenseCategory.findMany({ where: { group: "recurring", active: true }, orderBy: { sort: "asc" } }),
    prisma.expense.findMany({ where: { date: { gte: start, lt: end } }, select: { categoryId: true, amountCents: true, date: true } }),
    prisma.monthlyBudget.findMany({ where: { yearMonth: { in: list } } }),
  ]);
  const key = (c: string, m: string) => `${c}|${m}`;
  const spent = new Map<string, number>();
  for (const e of expenses) {
    const m = e.date.toISOString().slice(0, 7);
    spent.set(key(e.categoryId, m), (spent.get(key(e.categoryId, m)) ?? 0) + e.amountCents);
  }
  const ov = new Map(overrides.map((o) => [key(o.categoryId, o.yearMonth), o.amountCents]));
  const rows = cats.map((c) => ({
    categoryId: c.id,
    name: c.name,
    cells: list.map((m) => ({
      month: m,
      spentCents: spent.get(key(c.id, m)) ?? 0,
      budgetCents: monthlyBudgetFor(c, m, settings.apertura_mes, ov.get(key(c.id, m))),
      overridden: ov.has(key(c.id, m)),
    })),
  }));
  const totals = list.map((m, i) => ({
    month: m,
    spentCents: rows.reduce((s, r) => s + r.cells[i].spentCents, 0),
    budgetCents: rows.reduce((s, r) => s + r.cells[i].budgetCents, 0),
  }));
  return { months: list, rows, totals, openingMonth: settings.apertura_mes };
}

/**
 * Recurrentes esperados en el mes: pares (categoría, proveedor) marcados como recurrentes en los
 * 3 meses anteriores que todavía no tienen un gasto cargado este mes.
 */
export async function expectedRecurring(yearMonth: string) {
  const prev = monthRange(addMonths(yearMonth, -3));
  const cur = monthRange(yearMonth);
  const [past, current] = await Promise.all([
    prisma.expense.findMany({ where: { recurring: true, frequency: "monthly", date: { gte: prev.start, lt: cur.start } }, include: { category: true }, orderBy: { date: "desc" } }),
    prisma.expense.findMany({ where: { date: { gte: cur.start, lt: cur.end } }, select: { categoryId: true, vendor: true } }),
  ]);
  const loaded = new Set(current.map((e) => `${e.categoryId}|${e.vendor.trim().toLowerCase()}`));
  const seen = new Map<string, { category: string; vendor: string; amountCents: number; categoryId: string }>();
  for (const e of past) {
    const k = `${e.categoryId}|${e.vendor.trim().toLowerCase()}`;
    if (!seen.has(k) && !loaded.has(k)) seen.set(k, { category: e.category.name, vendor: e.vendor, amountCents: e.amountCents, categoryId: e.categoryId });
  }
  return Array.from(seen.values());
}

export async function setOpeningBudget(group: string, amountCents: number) {
  const before = await prisma.openingBudget.findUnique({ where: { group } });
  const after = await prisma.openingBudget.upsert({ where: { group }, create: { group, amountCents }, update: { amountCents } });
  await audit("opening_budgets", group, before ? { amountCents: before.amountCents } : null, { amountCents: after.amountCents });
}

export async function setCategoryMonthlyBudget(categoryId: string, monthlyBudgetCents: number, monthlyBudgetLaterCents: number | null) {
  const before = await prisma.expenseCategory.findUniqueOrThrow({ where: { id: categoryId } });
  const after = await prisma.expenseCategory.update({ where: { id: categoryId }, data: { monthlyBudgetCents, monthlyBudgetLaterCents } });
  await audit("expense_categories", categoryId, { monthlyBudgetCents: before.monthlyBudgetCents, later: before.monthlyBudgetLaterCents }, { monthlyBudgetCents: after.monthlyBudgetCents, later: after.monthlyBudgetLaterCents });
}

export async function setMonthOverride(categoryId: string, yearMonth: string, amountCents: number | null) {
  if (amountCents == null) {
    await prisma.monthlyBudget.deleteMany({ where: { categoryId, yearMonth } });
  } else {
    await prisma.monthlyBudget.upsert({ where: { yearMonth_categoryId: { yearMonth, categoryId } }, create: { yearMonth, categoryId, amountCents }, update: { amountCents } });
  }
  await audit("monthly_budgets", `${categoryId}:${yearMonth}`, null, { amountCents });
}

/** CSV para el contador, rango de fechas inclusive. */
export async function expensesCsv(from: Date, to: Date): Promise<string> {
  const rows = await prisma.expense.findMany({ where: { date: { gte: from, lte: to } }, include: { category: true }, orderBy: { date: "asc" } });
  return toCsv(
    ["Fecha", "Categoría", "Grupo", "Proveedor", "Monto", "Método de pago", "Pagado", "Reembolsable", "Reembolsado el", "Recurrente", "Notas", "Comprobante"],
    rows.map((e) => [
      e.date.toISOString().slice(0, 10), e.category.name, e.category.group === "opening" ? "Apertura" : "Recurrente", e.vendor, (e.amountCents / 100).toFixed(2),
      PAYMENT_METHOD_LABELS[e.paymentMethod], e.paid ? "sí" : "no", e.reimbursable ? "sí" : "no", e.reimbursedOn ? e.reimbursedOn.toISOString().slice(0, 10) : "",
      e.recurring ? (e.frequency ?? "monthly") : "", e.notes ?? "", e.receiptPath ? "sí" : "no",
    ]),
    { bom: true },
  );
}
