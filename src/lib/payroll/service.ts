import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { signedUrl, uploadToBucket } from "@/lib/storage";
import { toCsv } from "@/lib/csv";
import { formatCents } from "@/lib/money";
import { monthRange, monthlyBudgetFor } from "@/lib/expenses/budget";
import type { PayPeriod, PayPeriodLine, Employee } from "@/generated/prisma/client";
import { computePayroll, grossCents } from "./calc";
import { addDaysKey, dateKeyInTz, keyToUtc, periodFor, prevPeriod, utcToKey, weekStartOf, type Period } from "./periods";
import { hashPin, verifyPin } from "./pin";

export const CLOCK_PHOTOS_BUCKET = "clock-photos";

// ---------------------------------------------------------------------------
// Empleados
// ---------------------------------------------------------------------------

export type EmployeeInput = { name: string; pin?: string | null; hourlyRateCents: number; hiredOn?: Date | null; active: boolean; phone?: string | null; email?: string | null; notes?: string | null; shopifyStaffName?: string | null };

export async function saveEmployee(id: string | null, input: EmployeeInput) {
  const user = await getCurrentUser();
  if (input.pin) {
    // El PIN tiene que ser único entre activos para que el kiosco identifique a la persona.
    const others = await prisma.employee.findMany({ where: { active: true, ...(id ? { id: { not: id } } : {}) }, select: { pinHash: true } });
    if (others.some((o) => verifyPin(input.pin!, o.pinHash))) throw new Error("Ese PIN ya lo usa otra empleada. Elegí otro.");
  }
  const base = { name: input.name.trim(), hourlyRateCents: input.hourlyRateCents, hiredOn: input.hiredOn ?? null, active: input.active, phone: input.phone || null, email: input.email || null, notes: input.notes || null, shopifyStaffName: input.shopifyStaffName || null };
  if (id) {
    const before = await prisma.employee.findUniqueOrThrow({ where: { id } });
    const after = await prisma.employee.update({ where: { id }, data: { ...base, ...(input.pin ? { pinHash: hashPin(input.pin) } : {}) } });
    await audit("employees", id, { name: before.name, hourlyRateCents: before.hourlyRateCents, active: before.active }, { name: after.name, hourlyRateCents: after.hourlyRateCents, active: after.active, pinChanged: !!input.pin });
    return after;
  }
  if (!input.pin) throw new Error("Falta el PIN de 4 dígitos");
  const created = await prisma.employee.create({ data: { ...base, pinHash: hashPin(input.pin), createdBy: user?.id ?? null } });
  await audit("employees", created.id, null, { name: created.name, hourlyRateCents: created.hourlyRateCents });
  return created;
}

// ---------------------------------------------------------------------------
// Fichaje (kiosco)
// ---------------------------------------------------------------------------

export type ClockResult = { employeeName: string; action: "in" | "out"; at: Date; hoursToday?: number };

/** Identifica por PIN y ficha entrada o salida según corresponda. */
export async function clockByPin(pin: string, photo?: { bytes: Buffer; contentType: string } | null): Promise<ClockResult> {
  if (!/^\d{4}$/.test(pin)) throw new Error("PIN inválido");
  const employees = await prisma.employee.findMany({ where: { active: true } });
  const emp = employees.find((e) => verifyPin(pin, e.pinHash));
  if (!emp) throw new Error("PIN incorrecto");
  const open = await prisma.timeEntry.findFirst({ where: { employeeId: emp.id, clockOut: null }, orderBy: { clockIn: "desc" } });
  const now = new Date();
  let photoPath: string | null = null;
  if (photo) {
    photoPath = `${emp.id}/${now.toISOString().replace(/[:.]/g, "-")}.jpg`;
    await uploadToBucket(CLOCK_PHOTOS_BUCKET, photoPath, photo.bytes, photo.contentType || "image/jpeg", false).catch(() => { photoPath = null; });
  }
  if (open) {
    // Entrada abierta hace más de 16 h: se asume que olvidó fichar; se cierra y se avisa en la nota.
    const stale = now.getTime() - open.clockIn.getTime() > 16 * 3_600_000;
    await prisma.timeEntry.update({ where: { id: open.id }, data: { clockOut: now, photoOutPath: photoPath, note: stale ? "Salida automática: entrada abierta más de 16 h. Revisar." : open.note } });
    const hours = Math.round(((now.getTime() - open.clockIn.getTime()) / 3_600_000) * 100) / 100;
    return { employeeName: emp.name, action: "out", at: now, hoursToday: hours };
  }
  await prisma.timeEntry.create({ data: { employeeId: emp.id, clockIn: now, photoInPath: photoPath } });
  return { employeeName: emp.name, action: "in", at: now };
}

export async function whoIsIn() {
  return prisma.timeEntry.findMany({ where: { clockOut: null }, include: { employee: true }, orderBy: { clockIn: "asc" } });
}

// ---------------------------------------------------------------------------
// Entradas (corrección por owner)
// ---------------------------------------------------------------------------

export type EntryInput = { employeeId: string; clockIn: Date; clockOut: Date | null; breakMinutes: number; note?: string | null };

export async function upsertEntry(id: string | null, input: EntryInput) {
  const user = await getCurrentUser();
  if (input.clockOut && input.clockOut <= input.clockIn) throw new Error("La salida tiene que ser después de la entrada");
  if (input.clockOut && input.clockOut.getTime() - input.clockIn.getTime() > 24 * 3_600_000) throw new Error("Una entrada no puede durar más de 24 h");
  const period = periodFor(dateKeyInTz(input.clockIn, (await getSettings()).tienda_timezone));
  const closed = await prisma.payPeriod.findFirst({ where: { startsOn: keyToUtc(period.start), status: { not: "open" } } });
  if (closed) throw new Error(`El período ${period.start} – ${period.end} ya está cerrado. Reabrilo para corregir.`);
  const data = { employeeId: input.employeeId, clockIn: input.clockIn, clockOut: input.clockOut, breakMinutes: input.breakMinutes, note: input.note || null, editedBy: user?.id ?? null };
  if (id) {
    const before = await prisma.timeEntry.findUniqueOrThrow({ where: { id } });
    const after = await prisma.timeEntry.update({ where: { id }, data });
    await audit("time_entries", id, { clockIn: before.clockIn, clockOut: before.clockOut, breakMinutes: before.breakMinutes }, { clockIn: after.clockIn, clockOut: after.clockOut, breakMinutes: after.breakMinutes });
    return after;
  }
  const created = await prisma.timeEntry.create({ data: { ...data, createdBy: user?.id ?? null } });
  await audit("time_entries", created.id, null, { clockIn: created.clockIn, clockOut: created.clockOut, breakMinutes: created.breakMinutes, manual: true });
  return created;
}

export async function deleteEntry(id: string) {
  const before = await prisma.timeEntry.findUniqueOrThrow({ where: { id } });
  await prisma.timeEntry.delete({ where: { id } });
  await audit("time_entries", id, { clockIn: before.clockIn, clockOut: before.clockOut }, null, "delete");
}

export async function photoUrl(p: string | null) {
  return p ? signedUrl(CLOCK_PHOTOS_BUCKET, p, 600).catch(() => null) : null;
}

// ---------------------------------------------------------------------------
// Períodos y nómina
// ---------------------------------------------------------------------------

export async function currentPeriod(): Promise<Period> {
  const s = await getSettings();
  return periodFor(dateKeyInTz(new Date(), s.tienda_timezone));
}

/** Entradas de las semanas que tocan un período (con margen de una semana a cada lado). */
async function entriesAround(period: Period, weekStartsOn: "monday" | "sunday") {
  const from = keyToUtc(addDaysKey(weekStartOf(period.start, weekStartsOn), -1));
  const to = keyToUtc(addDaysKey(period.end, 9));
  return prisma.timeEntry.findMany({ where: { clockIn: { gte: from, lt: to } }, orderBy: { clockIn: "asc" } });
}

export type PeriodPreview = {
  period: Period;
  lines: { employeeId: string; name: string; regularHours: number; overtimeHours: number; rateCents: number; grossCents: number }[];
  totalGrossCents: number;
  openEntries: number;
};

export async function previewPeriod(period: Period): Promise<PeriodPreview> {
  const s = await getSettings();
  const weekStartsOn = s.semana_inicia === "sunday" ? "sunday" : "monday";
  const [entries, employees] = await Promise.all([entriesAround(period, weekStartsOn), prisma.employee.findMany({ orderBy: { name: "asc" } })]);
  const calc = computePayroll(entries, { period, timeZone: s.tienda_timezone, weekStartsOn, overtimeThresholdHours: s.overtime_umbral_horas });
  const from = keyToUtc(period.start);
  const to = keyToUtc(addDaysKey(period.end, 1));
  const openEntries = entries.filter((e) => !e.clockOut && e.clockIn >= from && e.clockIn < to).length;
  const lines = employees
    .map((emp) => {
      const c = calc.find((x) => x.employeeId === emp.id);
      if (!c && !emp.active) return null;
      const regularHours = c?.regularHours ?? 0;
      const overtimeHours = c?.overtimeHours ?? 0;
      return { employeeId: emp.id, name: emp.name, regularHours, overtimeHours, rateCents: emp.hourlyRateCents, grossCents: grossCents(regularHours, overtimeHours, emp.hourlyRateCents) };
    })
    .filter((x): x is NonNullable<typeof x> => !!x && (x.regularHours > 0 || x.overtimeHours > 0 || true));
  return { period, lines, totalGrossCents: lines.reduce((s, l) => s + l.grossCents, 0), openEntries };
}

export async function closePeriod(period: Period) {
  const user = await getCurrentUser();
  const preview = await previewPeriod(period);
  if (preview.openEntries > 0) throw new Error(`Hay ${preview.openEntries} entrada(s) sin salida en el período. Corregilas antes de cerrar.`);
  const existing = await prisma.payPeriod.findUnique({ where: { startsOn_endsOn: { startsOn: keyToUtc(period.start), endsOn: keyToUtc(period.end) } } });
  if (existing && existing.status !== "open") throw new Error("El período ya está cerrado");
  const pp = await prisma.payPeriod.upsert({
    where: { startsOn_endsOn: { startsOn: keyToUtc(period.start), endsOn: keyToUtc(period.end) } },
    create: { startsOn: keyToUtc(period.start), endsOn: keyToUtc(period.end), status: "closed", closedAt: new Date(), createdBy: user?.id ?? null },
    update: { status: "closed", closedAt: new Date() },
  });
  await prisma.payPeriodLine.deleteMany({ where: { payPeriodId: pp.id } });
  await prisma.payPeriodLine.createMany({
    data: preview.lines.filter((l) => l.regularHours > 0 || l.overtimeHours > 0).map((l) => ({ payPeriodId: pp.id, employeeId: l.employeeId, regularHours: l.regularHours, overtimeHours: l.overtimeHours, rateCents: l.rateCents, grossCents: l.grossCents, createdBy: user?.id ?? null })),
  });
  await audit("pay_periods", pp.id, null, { period, totalGrossCents: preview.totalGrossCents, employees: preview.lines.length }, "close");
  return pp;
}

export async function reopenPeriod(id: string) {
  const before = await prisma.payPeriod.findUniqueOrThrow({ where: { id } });
  if (before.status === "paid") throw new Error("Un período pagado no se reabre");
  await prisma.payPeriodLine.deleteMany({ where: { payPeriodId: id } });
  await prisma.payPeriod.update({ where: { id }, data: { status: "open", closedAt: null } });
  await audit("pay_periods", id, { status: before.status }, { status: "open" });
}

export async function markPeriodPaid(id: string) {
  const before = await prisma.payPeriod.findUniqueOrThrow({ where: { id } });
  if (before.status !== "closed") throw new Error("Primero hay que cerrar el período");
  await prisma.payPeriod.update({ where: { id }, data: { status: "paid", paidAt: new Date() } });
  await audit("pay_periods", id, { status: before.status }, { status: "paid" });
}

export async function getClosedPeriod(id: string) {
  return prisma.payPeriod.findUnique({ where: { id }, include: { lines: { include: { employee: true }, orderBy: { employee: { name: "asc" } } } } });
}

export async function listPeriods() {
  return prisma.payPeriod.findMany({ include: { lines: { select: { grossCents: true } } }, orderBy: { startsOn: "desc" }, take: 48 });
}

type FullPeriod = PayPeriod & { lines: (PayPeriodLine & { employee: Employee })[] };

/** CSV para el proveedor de nómina: nombre, regular hours, overtime hours, rate. */
export function periodCsv(p: FullPeriod): string {
  return toCsv(
    ["Employee", "Regular Hours", "Overtime Hours", "Rate", "Gross", "Period Start", "Period End"],
    p.lines.map((l) => [l.employee.name, Number(l.regularHours).toFixed(2), Number(l.overtimeHours).toFixed(2), (l.rateCents / 100).toFixed(2), (l.grossCents / 100).toFixed(2), utcToKey(p.startsOn), utcToKey(p.endsOn)]),
  );
}

export async function periodPdf(p: FullPeriod): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(await readFile(path.join(process.cwd(), "public", "logo-dark.png")));
  const page = pdf.addPage([612, 792]);
  const M = 48;
  const TAB = rgb(0.243, 0.176, 0.118);
  const GR = rgb(0.45, 0.4, 0.35);
  let y = 792 - M;
  page.drawImage(logo, { x: M, y: y - 22, width: 110, height: 110 * (logo.height / logo.width) });
  page.drawText("Resumen de nómina", { x: 612 - M - bold.widthOfTextAtSize("Resumen de nómina", 16), y: y - 14, size: 16, font: bold, color: TAB });
  page.drawText(`${utcToKey(p.startsOn)} a ${utcToKey(p.endsOn)}`, { x: 612 - M - font.widthOfTextAtSize(`${utcToKey(p.startsOn)} a ${utcToKey(p.endsOn)}`, 10), y: y - 30, size: 10, font, color: GR });
  y -= 70;
  const cols = [{ l: "Empleada", x: M, w: 200 }, { l: "Horas normales", x: M + 210, w: 80, r: true }, { l: "Horas extra", x: M + 300, w: 70, r: true }, { l: "Tarifa", x: M + 380, w: 60, r: true }, { l: "Bruto", x: M + 450, w: 66, r: true }];
  page.drawRectangle({ x: M, y: y - 4, width: 612 - M * 2, height: 16, color: rgb(0.945, 0.922, 0.878) });
  for (const c of cols) page.drawText(c.l, { x: c.r ? c.x + c.w - bold.widthOfTextAtSize(c.l, 8) : c.x, y, size: 8, font: bold, color: TAB });
  y -= 20;
  const cell = (t: string, c: (typeof cols)[number], f = font) => page.drawText(t, { x: c.r ? c.x + c.w - f.widthOfTextAtSize(t, 10) : c.x, y, size: 10, font: f, color: TAB });
  let total = 0;
  for (const l of p.lines) {
    cell(l.employee.name, cols[0]);
    cell(Number(l.regularHours).toFixed(2), cols[1]);
    cell(Number(l.overtimeHours).toFixed(2), cols[2]);
    cell(formatCents(l.rateCents), cols[3]);
    cell(formatCents(l.grossCents), cols[4], bold);
    total += l.grossCents;
    y -= 16;
  }
  y -= 6;
  page.drawLine({ start: { x: M + 380, y }, end: { x: 612 - M, y }, thickness: 0.5, color: rgb(0.753, 0.557, 0.227) });
  y -= 16;
  page.drawText("Total bruto", { x: M + 380, y, size: 11, font: bold, color: TAB });
  page.drawText(formatCents(total), { x: 612 - M - bold.widthOfTextAtSize(formatCents(total), 11), y, size: 11, font: bold, color: TAB });
  y -= 30;
  page.drawText("Hora extra 1.5× sobre 40 h por semana (lunes a domingo). Bruto sin retenciones: las calcula el proveedor de nómina.", { x: M, y, size: 8, font, color: GR });
  page.drawText(`Estado: ${p.status === "paid" ? "pagado" : "cerrado"}${p.paidAt ? ` el ${utcToKey(p.paidAt)}` : ""}`, { x: M, y: y - 12, size: 8, font, color: GR });
  return pdf.save();
}

// ---------------------------------------------------------------------------
// Reportes
// ---------------------------------------------------------------------------

/** Costo bruto de nómina por mes (períodos cerrados o pagados) vs presupuesto de la categoría "Nómina". */
export async function payrollByMonth(months: string[]) {
  if (months.length === 0) return [];
  const [s, cat] = await Promise.all([getSettings(), prisma.expenseCategory.findUnique({ where: { name: "Nómina" } })]);
  // Una sola consulta para todo el rango: una por mes hacía lenta la pantalla en serverless.
  const periods = await prisma.payPeriod.findMany({
    where: { startsOn: { gte: monthRange(months[0]).start, lt: monthRange(months[months.length - 1]).end }, status: { not: "open" } },
    select: { startsOn: true, lines: { select: { grossCents: true } } },
  });
  const gross = new Map<string, number>();
  for (const p of periods) {
    const m = p.startsOn.toISOString().slice(0, 7);
    gross.set(m, (gross.get(m) ?? 0) + p.lines.reduce((a, l) => a + l.grossCents, 0));
  }
  return months.map((m) => ({ month: m, grossCents: gross.get(m) ?? 0, budgetCents: cat ? monthlyBudgetFor(cat, m, s.apertura_mes) : 0 }));
}

/** Ventas del POS por vendedora en un período (por shopify_staff_name), contra la meta. */
export async function salesByEmployee(period: Period) {
  const s = await getSettings();
  const from = keyToUtc(period.start);
  const to = keyToUtc(addDaysKey(period.end, 1));
  const [employees, orders] = await Promise.all([
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.order.findMany({ where: { placedAt: { gte: from, lt: to }, cancelledAt: null, staffName: { not: null } }, include: { items: { select: { qty: true, refundedQty: true } } } }),
  ]);
  return employees.map((e) => {
    const mine = orders.filter((o) => e.shopifyStaffName && o.staffName?.trim().toLowerCase() === e.shopifyStaffName.trim().toLowerCase());
    const netCents = mine.reduce((a, o) => a + o.totalCents - o.refundedCents, 0);
    const units = mine.reduce((a, o) => a + o.items.reduce((b, i) => b + i.qty - i.refundedQty, 0), 0);
    return { employeeId: e.id, name: e.name, staffName: e.shopifyStaffName, orders: mine.length, units, netCents, goalCents: s.meta_ventas_periodo, pct: s.meta_ventas_periodo ? Math.round((netCents / s.meta_ventas_periodo) * 100) : null };
  });
}

export { prevPeriod };
