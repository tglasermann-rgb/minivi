import { describe, expect, it } from "vitest";
import { buildInstallments, purchaseTotals, splitCents } from "./terms";

describe("condiciones de pago", () => {
  it("reparte centavos sin perder el resto", () => {
    expect(splitCents(100000, 3)).toEqual([33334, 33333, 33333]);
    expect(splitCents(100, 2)).toEqual([50, 50]);
    expect(splitCents(1, 3)).toEqual([1, 0, 0]);
  });

  it("30/60/90 genera tres cuotas con fechas correctas", () => {
    const from = new Date("2026-09-01T00:00:00Z");
    const cuotas = buildInstallments(600000, "30_60_90", from);
    expect(cuotas).toHaveLength(3);
    expect(cuotas.map((c) => c.amountCents)).toEqual([200000, 200000, 200000]);
    expect(cuotas.map((c) => c.dueOn.toISOString().slice(0, 10))).toEqual(["2026-10-01", "2026-10-31", "2026-11-30"]);
  });

  it("contado vence el mismo día; 30 días una sola cuota", () => {
    const from = new Date("2026-09-01T00:00:00Z");
    expect(buildInstallments(5000, "contado", from)).toEqual([{ amountCents: 5000, dueOn: from }]);
    expect(buildInstallments(5000, "30", from)[0].dueOn.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(buildInstallments(0, "30", from)).toEqual([]);
  });

  it("custom valida que las cuotas sumen el total", () => {
    const from = new Date("2026-09-01T00:00:00Z");
    expect(() => buildInstallments(1000, "custom", from, [{ amountCents: 500, dueOn: from }])).toThrow(/suman/);
    expect(buildInstallments(1000, "custom", from, [{ amountCents: 400, dueOn: from }, { amountCents: 600, dueOn: from }])).toHaveLength(2);
  });

  it("totales de la compra", () => {
    expect(purchaseTotals([{ qty: 20, unitCostCents: 21000 }, { qty: 2, unitCostCents: 5000 }], 1000, 2500)).toEqual({ subtotalCents: 430000, totalCents: 433500 });
  });
});
