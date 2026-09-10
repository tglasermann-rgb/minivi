/** Utilidades de meses (YYYY-MM) y presupuesto mensual según el plan. */

export function yearMonthOf(d: Date, timeZone = "America/New_York"): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}`;
}

export function addMonths(yearMonth: string, n: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const yy = Math.floor(total / 12);
  const mm = (total % 12) + 1;
  return `${yy}-${String(mm).padStart(2, "0")}`;
}

/** Número de mes del plan: apertura = 1. Antes de la apertura devuelve 0 o negativo. */
export function planMonthIndex(yearMonth: string, openingMonth: string): number {
  const [y, m] = yearMonth.split("-").map(Number);
  const [oy, om] = openingMonth.split("-").map(Number);
  return (y * 12 + m) - (oy * 12 + om) + 1;
}

/** Rango [inicio, fin) de un mes en UTC (las fechas de gastos son DATE). */
export function monthRange(yearMonth: string): { start: Date; end: Date } {
  const [y, m] = yearMonth.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

export function monthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Intl.DateTimeFormat("es-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/**
 * Presupuesto mensual de una categoría para un mes dado:
 * override del mes > (mes ≥ 7 del plan y hay valor "later") > valor base.
 */
export function monthlyBudgetFor(
  cat: { monthlyBudgetCents: number; monthlyBudgetLaterCents: number | null },
  yearMonth: string,
  openingMonth: string,
  override?: number | null,
): number {
  if (override != null) return override;
  if (cat.monthlyBudgetLaterCents != null && planMonthIndex(yearMonth, openingMonth) >= 7) return cat.monthlyBudgetLaterCents;
  return cat.monthlyBudgetCents;
}
