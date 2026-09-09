/** Helpers de dinero. En la base todo va en centavos (integer). */

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

/** 30000 → "$300.00" */
export function formatCents(cents: number): string {
  return usd.format(cents / 100);
}

/** "300" | "300.5" | "$1,250.00" → 30000 | 30050 | 125000. Lanza si no es un número válido. */
export function parseDollarsToCents(input: string | number): number {
  const cleaned = String(input).replace(/[$,\s]/g, "");
  if (cleaned === "" || !/^-?\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error(`Monto inválido: "${input}"`);
  }
  const [whole, frac = ""] = cleaned.split(".");
  const sign = whole.startsWith("-") ? -1 : 1;
  const w = Math.abs(Number(whole));
  const f = Number((frac + "00").slice(0, 2));
  return sign * (w * 100 + f);
}

/** 30000 → "300.00" (para inputs numéricos) */
export function centsToDollarsString(cents: number): string {
  return (cents / 100).toFixed(2);
}
