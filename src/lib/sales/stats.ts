import "server-only";
import { TZDate } from "@date-fns/tz";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import type { SalesChannel } from "@/generated/prisma/client";

export type Range = { start: Date; end: Date; label: string };

function startOfDayTz(d: Date, tz: string): TZDate {
  const t = new TZDate(d, tz);
  return new TZDate(t.getFullYear(), t.getMonth(), t.getDate(), tz);
}

/** Rangos hoy / esta semana (lunes–domingo) / este mes, en la zona de la tienda. */
export async function ranges(now = new Date()): Promise<{ today: Range; week: Range; month: Range; tz: string }> {
  const s = await getSettings();
  const tz = s.tienda_timezone;
  const day = startOfDayTz(now, tz);
  const dow = day.getDay();
  const offset = s.semana_inicia === "sunday" ? dow : (dow + 6) % 7;
  const weekStart = new TZDate(day.getFullYear(), day.getMonth(), day.getDate() - offset, tz);
  const monthStart = new TZDate(day.getFullYear(), day.getMonth(), 1, tz);
  const tomorrow = new TZDate(day.getFullYear(), day.getMonth(), day.getDate() + 1, tz);
  const nextWeek = new TZDate(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7, tz);
  const nextMonth = new TZDate(day.getFullYear(), day.getMonth() + 1, 1, tz);
  return {
    today: { start: new Date(day.getTime()), end: new Date(tomorrow.getTime()), label: "Hoy" },
    week: { start: new Date(weekStart.getTime()), end: new Date(nextWeek.getTime()), label: "Esta semana" },
    month: { start: new Date(monthStart.getTime()), end: new Date(nextMonth.getTime()), label: "Este mes" },
    tz,
  };
}

export type Summary = {
  orders: number; units: number; grossCents: number; refundedCents: number; netCents: number; costCents: number; marginCents: number; grams: number; avgTicketCents: number;
  byChannel: { channel: SalesChannel; orders: number; netCents: number }[];
  byStaff: { staff: string; orders: number; netCents: number }[];
  byType: { type: string; units: number; netCents: number }[];
};

export async function summarize(r: { start: Date; end: Date }): Promise<Summary> {
  const orders = await prisma.order.findMany({
    where: { placedAt: { gte: r.start, lt: r.end }, cancelledAt: null },
    include: { items: { include: {} } },
  });
  const productIds = Array.from(new Set(orders.flatMap((o) => o.items.map((i) => i.productId)).filter((x): x is string => !!x)));
  const products = productIds.length ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, type: true } }) : [];
  const typeOf = new Map(products.map((p) => [p.id, p.type as string]));

  let units = 0, grossCents = 0, refundedCents = 0, costCents = 0, grams = 0;
  const byChannel = new Map<SalesChannel, { orders: number; netCents: number }>();
  const byStaff = new Map<string, { orders: number; netCents: number }>();
  const byType = new Map<string, { units: number; netCents: number }>();
  for (const o of orders) {
    const net = o.totalCents - o.refundedCents;
    grossCents += o.totalCents; refundedCents += o.refundedCents;
    const c = byChannel.get(o.channel) ?? { orders: 0, netCents: 0 }; c.orders++; c.netCents += net; byChannel.set(o.channel, c);
    const staff = o.staffName ?? (o.channel === "pos" ? "Sin vendedor" : "Online");
    const st = byStaff.get(staff) ?? { orders: 0, netCents: 0 }; st.orders++; st.netCents += net; byStaff.set(staff, st);
    for (const i of o.items) {
      const q = i.qty - i.refundedQty;
      units += q;
      costCents += (i.costCentsAtSale ?? 0) * q;
      grams += Number(i.gramsAtSale ?? 0) * q;
      const t = (i.productId && typeOf.get(i.productId)) || "otros";
      const bt = byType.get(t) ?? { units: 0, netCents: 0 }; bt.units += q; bt.netCents += (i.priceCents * q) - Math.round((i.discountCents / Math.max(1, i.qty)) * q); byType.set(t, bt);
    }
  }
  const netCents = grossCents - refundedCents;
  return {
    orders: orders.length, units, grossCents, refundedCents, netCents, costCents, marginCents: netCents - costCents, grams: Math.round(grams * 100) / 100,
    avgTicketCents: orders.length ? Math.round(netCents / orders.length) : 0,
    byChannel: Array.from(byChannel, ([channel, v]) => ({ channel, ...v })).sort((a, b) => b.netCents - a.netCents),
    byStaff: Array.from(byStaff, ([staff, v]) => ({ staff, ...v })).sort((a, b) => b.netCents - a.netCents),
    byType: Array.from(byType, ([type, v]) => ({ type, ...v })).sort((a, b) => b.netCents - a.netCents),
  };
}

/** Unidades vendidas por semana (últimas N semanas, la actual incluida) contra los umbrales del plan. */
export async function weeklyUnits(weeks = 8) {
  const s = await getSettings();
  const { week, tz } = await ranges();
  const out: { start: Date; end: Date; units: number; netCents: number; orders: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = new TZDate(week.start, tz);
    const start = new TZDate(ws.getFullYear(), ws.getMonth(), ws.getDate() - 7 * i, tz);
    const end = new TZDate(start.getFullYear(), start.getMonth(), start.getDate() + 7, tz);
    const orders = await prisma.order.findMany({ where: { placedAt: { gte: new Date(start.getTime()), lt: new Date(end.getTime()) }, cancelledAt: null }, include: { items: { select: { qty: true, refundedQty: true } } } });
    out.push({
      start: new Date(start.getTime()), end: new Date(end.getTime()), orders: orders.length,
      units: orders.reduce((a, o) => a + o.items.reduce((b, i) => b + i.qty - i.refundedQty, 0), 0),
      netCents: orders.reduce((a, o) => a + o.totalCents - o.refundedCents, 0),
    });
  }
  return {
    weeks: out,
    thresholds: { base: s.ventas_semana_base, conservador: s.ventas_semana_conservador, optimista: s.ventas_semana_optimista, cubreGastos: s.ventas_semana_cubre_gastos, cubreGastosYBanco: s.ventas_semana_cubre_gastos_y_banco },
  };
}
