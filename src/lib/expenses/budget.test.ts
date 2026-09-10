import { describe, expect, it } from "vitest";
import { addMonths, monthRange, monthlyBudgetFor, planMonthIndex, yearMonthOf } from "./budget";

describe("presupuesto mensual", () => {
  it("meses del plan y aritmética", () => {
    expect(planMonthIndex("2026-10", "2026-10")).toBe(1);
    expect(planMonthIndex("2027-03", "2026-10")).toBe(6);
    expect(planMonthIndex("2027-04", "2026-10")).toBe(7);
    expect(planMonthIndex("2026-09", "2026-10")).toBe(0);
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(monthRange("2026-02").end.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("marketing 2,500 los primeros 6 meses y 4,500 después; override manda", () => {
    const mk = { monthlyBudgetCents: 250000, monthlyBudgetLaterCents: 450000 };
    expect(monthlyBudgetFor(mk, "2026-10", "2026-10")).toBe(250000);
    expect(monthlyBudgetFor(mk, "2027-03", "2026-10")).toBe(250000);
    expect(monthlyBudgetFor(mk, "2027-04", "2026-10")).toBe(450000);
    expect(monthlyBudgetFor(mk, "2027-04", "2026-10", 300000)).toBe(300000);
    expect(monthlyBudgetFor({ monthlyBudgetCents: 240000, monthlyBudgetLaterCents: null }, "2028-01", "2026-10")).toBe(240000);
  });

  it("yearMonthOf usa la zona de la tienda", () => {
    // 2026-10-01 02:00 UTC es 2026-09-30 22:00 en New York
    expect(yearMonthOf(new Date("2026-10-01T02:00:00Z"))).toBe("2026-09");
    expect(yearMonthOf(new Date("2026-10-01T12:00:00Z"))).toBe("2026-10");
  });
});
