import { describe, expect, it } from "vitest";
import { computeCostCents, computePriceCents, costPerGramWithPremium, resolvePriceCents } from "./pricing";

describe("precio automático", () => {
  it("gramos × $300 redondeado hacia arriba a $5", () => {
    expect(computePriceCents(2.1, 30000, 500)).toBe(63000); // 630 exacto
    expect(computePriceCents(2.11, 30000, 500)).toBe(63500); // 633 → 635
    expect(computePriceCents(1.0, 30000, 500)).toBe(30000);
    expect(computePriceCents(0.83, 30000, 500)).toBe(25000); // 249 → 250
    expect(computePriceCents(3.33, 30000, 500)).toBe(100000); // 999 → 1000
  });

  it("no tiene errores de punto flotante", () => {
    expect(computePriceCents(0.1 + 0.2, 30000, 500)).toBe(9000); // 0.3 g → 90
    expect(computePriceCents(1.15, 30000, 500)).toBe(34500);
  });

  it("respeta otro redondeo y otro precio", () => {
    expect(computePriceCents(2.0, 31000, 1000)).toBe(62000);
    expect(computePriceCents(2.01, 31000, 1000)).toBe(63000);
    expect(computePriceCents(2.0, 30000, 1)).toBe(60000);
  });

  it("gramos en 0 dan precio 0; parámetros inválidos lanzan", () => {
    expect(computePriceCents(0, 30000, 500)).toBe(0);
    expect(() => computePriceCents(1, 0, 500)).toThrow();
    expect(() => computePriceCents(1, 30000, 0)).toThrow();
  });

  it("costo = gramos × costo por gramo", () => {
    expect(computeCostCents(2.1, 10000)).toBe(21000);
    expect(computeCostCents(2.13, 10000)).toBe(21300);
    expect(computeCostCents(1.01, 9999)).toBe(10099); // 1.01 g × 99.99
  });

  it("override manda", () => {
    expect(resolvePriceCents({ grams: 2.1, priceOverride: true, overridePriceCents: 59900, pricePerGramCents: 30000, roundingCents: 500 })).toBe(59900);
    expect(resolvePriceCents({ grams: 2.1, priceOverride: false, overridePriceCents: 59900, pricePerGramCents: 30000, roundingCents: 500 })).toBe(63000);
    expect(() => resolvePriceCents({ grams: 2.1, priceOverride: true, pricePerGramCents: 30000, roundingCents: 500 })).toThrow();
  });
});

describe("el \"+\" de la compra", () => {
  it("suma dólares por gramo sobre la base", () => {
    // base $95/g
    expect(costPerGramWithPremium(9500, 0)).toBe(9500);
    expect(costPerGramWithPremium(9500, 800)).toBe(10300);
    expect(costPerGramWithPremium(9500, 1000)).toBe(10500);
    expect(costPerGramWithPremium(9500, 1200)).toBe(10700);
    expect(costPerGramWithPremium(9500, 2000)).toBe(11500);
  });

  it("sin + la compra vale lo mismo que antes", () => {
    expect(costPerGramWithPremium(10000)).toBe(10000);
    expect(costPerGramWithPremium(10000, null)).toBe(10000);
  });

  it("un + negativo no abarata la mercadería", () => {
    expect(costPerGramWithPremium(9500, -500)).toBe(9500);
  });

  it("una pulsera de 10 g a base 95 con +12 sale $1,070.00", () => {
    expect(computeCostCents(10, costPerGramWithPremium(9500, 1200))).toBe(107000);
  });

  it("dos líneas de la misma compra con + distinto no se pisan", () => {
    const base = 9500;
    const pulseraA = computeCostCents(8.35, costPerGramWithPremium(base, 1000)); // +10 → $105/g
    const pulseraB = computeCostCents(8.35, costPerGramWithPremium(base, 1200)); // +12 → $107/g
    expect(pulseraA).toBe(87675);
    expect(pulseraB).toBe(89345);
    expect(pulseraB - pulseraA).toBe(1670); // 8.35 g × $2
  });
});
