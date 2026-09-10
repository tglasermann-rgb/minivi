/**
 * Precio al público = gramos × precio por gramo, redondeado HACIA ARRIBA
 * al múltiplo de `roundingCents`. Todo en centavos, sin punto flotante.
 *
 * @param grams        gramos con hasta 2 decimales (ej. 2.35)
 * @param pricePerGramCents  ej. 30000 ($300/g)
 * @param roundingCents      ej. 500 ($5)
 */
export function computePriceCents(grams: number, pricePerGramCents: number, roundingCents: number): number {
  if (!(grams > 0)) return 0;
  if (!Number.isInteger(pricePerGramCents) || pricePerGramCents <= 0) throw new Error("precio_por_gramo inválido");
  if (!Number.isInteger(roundingCents) || roundingCents <= 0) throw new Error("redondeo_precio inválido");
  const gramsHundredths = Math.round(grams * 100); // 2.35 → 235
  const rawCents = Math.ceil((gramsHundredths * pricePerGramCents) / 100);
  return Math.ceil(rawCents / roundingCents) * roundingCents;
}

/**
 * El "+" de una compra son dólares por gramo que se suman a la base:
 * base $95/g con +12 son $107/g. Cada línea de la compra puede tener el suyo,
 * así una pulsera va a +10 y otra a +12 dentro de la misma orden.
 *
 * @param basePerGramCents  costo por gramo de la compra, ej. 9500
 * @param premiumCents      el "+", ej. 1200. Negativo o nulo cuenta como cero.
 */
export function costPerGramWithPremium(basePerGramCents: number, premiumCents?: number | null): number {
  return basePerGramCents + Math.max(0, Math.round(premiumCents ?? 0));
}

/** Costo = gramos × costo por gramo (centavos), redondeado al centavo. */
export function computeCostCents(grams: number, costPerGramCents: number): number {
  if (!(grams > 0)) return 0;
  const gramsHundredths = Math.round(grams * 100);
  return Math.round((gramsHundredths * costPerGramCents) / 100);
}

/** Precio final respetando el override por pieza. */
export function resolvePriceCents(input: {
  grams: number;
  priceOverride: boolean;
  overridePriceCents?: number | null;
  pricePerGramCents: number;
  roundingCents: number;
}): number {
  if (input.priceOverride) {
    if (input.overridePriceCents == null || input.overridePriceCents < 0) throw new Error("Falta el precio manual");
    return input.overridePriceCents;
  }
  return computePriceCents(input.grams, input.pricePerGramCents, input.roundingCents);
}
