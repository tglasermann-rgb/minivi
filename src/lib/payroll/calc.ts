import { addDaysKey, dateKeyInTz, weekStartOf, type DateKey, type Period } from "./periods";

export type EntryLike = { employeeId: string; clockIn: Date; clockOut: Date | null; breakMinutes: number };

export type PayrollLine = { employeeId: string; regularHours: number; overtimeHours: number };

export type PayrollOptions = {
  period: Period;
  timeZone: string;
  weekStartsOn?: "monday" | "sunday";
  overtimeThresholdHours?: number;
};

/** Horas trabajadas de una entrada cerrada (sin el descanso), con 2 decimales. */
export function entryHours(e: EntryLike): number {
  if (!e.clockOut) return 0;
  const ms = e.clockOut.getTime() - e.clockIn.getTime();
  const h = ms / 3_600_000 - (e.breakMinutes ?? 0) / 60;
  return Math.max(0, Math.round(h * 100) / 100);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Calcula horas normales y extra por empleado para un período.
 *
 * Regla: la hora extra es 1.5× sobre `overtimeThresholdHours` por semana calendario
 * (lunes a domingo). Si una semana cruza dos períodos, las horas extra se atribuyen al
 * período en el que se superan las 40 h: se recorre la semana completa en orden y cada
 * entrada aporta al período de su fecha de entrada.
 *
 * `entries` debe incluir todas las entradas de las semanas que tocan el período
 * (el servicio las trae con margen); las que no caen en esas semanas se ignoran.
 */
export function computePayroll(entries: EntryLike[], opts: PayrollOptions): PayrollLine[] {
  const weekStartsOn = opts.weekStartsOn ?? "monday";
  const threshold = opts.overtimeThresholdHours ?? 40;
  const { period, timeZone } = opts;
  const inPeriod = (k: DateKey) => k >= period.start && k <= period.end;

  const firstWeek = weekStartOf(period.start, weekStartsOn);
  const lastWeekEnd = addDaysKey(weekStartOf(period.end, weekStartsOn), 6);

  type Row = EntryLike & { key: DateKey; week: DateKey; hours: number };
  const rows: Row[] = entries
    .filter((e) => e.clockOut)
    .map((e) => {
      const key = dateKeyInTz(e.clockIn, timeZone);
      return { ...e, key, week: weekStartOf(key, weekStartsOn), hours: entryHours(e) };
    })
    .filter((r) => r.key >= firstWeek && r.key <= lastWeekEnd)
    .sort((a, b) => a.clockIn.getTime() - b.clockIn.getTime());

  const byEmpWeek = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${r.employeeId}|${r.week}`;
    byEmpWeek.set(k, [...(byEmpWeek.get(k) ?? []), r]);
  }

  const totals = new Map<string, { regular: number; overtime: number }>();
  for (const list of byEmpWeek.values()) {
    let acc = 0;
    for (const r of list) {
      const before = acc;
      acc += r.hours;
      const regular = Math.max(0, Math.min(r.hours, threshold - before));
      const overtime = r.hours - regular;
      if (!inPeriod(r.key)) continue;
      const t = totals.get(r.employeeId) ?? { regular: 0, overtime: 0 };
      t.regular += regular;
      t.overtime += overtime;
      totals.set(r.employeeId, t);
    }
  }
  return Array.from(totals, ([employeeId, t]) => ({ employeeId, regularHours: r2(t.regular), overtimeHours: r2(t.overtime) }));
}

/** Bruto en centavos: normales × tarifa + extra × tarifa × 1.5, redondeado al centavo. */
export function grossCents(regularHours: number, overtimeHours: number, rateCents: number): number {
  return Math.round(regularHours * rateCents + overtimeHours * rateCents * 1.5);
}
