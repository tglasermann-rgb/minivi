/**
 * Períodos de nómina: del 1 al 15 y del 16 al último día del mes, en la zona horaria de la tienda.
 * Las fechas se manejan como claves "YYYY-MM-DD" (sin hora) para evitar líos de zona.
 */

export type DateKey = string; // YYYY-MM-DD
export type Period = { start: DateKey; end: DateKey };

export function dateKeyInTz(d: Date, timeZone: string): DateKey {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function keyToUtc(key: DateKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function utcToKey(d: Date): DateKey {
  return d.toISOString().slice(0, 10);
}

export function addDaysKey(key: DateKey, n: number): DateKey {
  const d = keyToUtc(key);
  d.setUTCDate(d.getUTCDate() + n);
  return utcToKey(d);
}

export function lastDayOfMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** Período (1–15 o 16–fin) que contiene la fecha. */
export function periodFor(key: DateKey): Period {
  const [y, m, d] = key.split("-").map(Number);
  const mm = String(m).padStart(2, "0");
  if (d <= 15) return { start: `${y}-${mm}-01`, end: `${y}-${mm}-15` };
  return { start: `${y}-${mm}-16`, end: `${y}-${mm}-${String(lastDayOfMonth(y, m)).padStart(2, "0")}` };
}

export function nextPeriod(p: Period): Period {
  return periodFor(addDaysKey(p.end, 1));
}

export function prevPeriod(p: Period): Period {
  return periodFor(addDaysKey(p.start, -1));
}

/** Lunes (o domingo) de la semana que contiene la fecha. */
export function weekStartOf(key: DateKey, weekStartsOn: "monday" | "sunday" = "monday"): DateKey {
  const d = keyToUtc(key);
  const dow = d.getUTCDay(); // 0 = domingo
  const offset = weekStartsOn === "monday" ? (dow + 6) % 7 : dow;
  return addDaysKey(key, -offset);
}

export function periodLabel(p: Period): string {
  const f = (k: DateKey) => { const [, m, d] = k.split("-"); return `${d}/${m}`; };
  return `${f(p.start)} – ${f(p.end)}`;
}
