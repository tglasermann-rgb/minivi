import { describe, expect, it } from "vitest";
import { centsToDollarsString, formatCents, parseDollarsToCents } from "./money";

describe("money", () => {
  it("formatea centavos como USD", () => {
    expect(formatCents(30000)).toBe("$300.00");
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(125000)).toBe("$1,250.00");
  });

  it("parsea dólares a centavos sin errores de punto flotante", () => {
    expect(parseDollarsToCents("300")).toBe(30000);
    expect(parseDollarsToCents("300.5")).toBe(30050);
    expect(parseDollarsToCents("$1,250.00")).toBe(125000);
    expect(parseDollarsToCents("0.1")).toBe(10);
    expect(parseDollarsToCents("-2.99")).toBe(-299);
    expect(parseDollarsToCents(19.99)).toBe(1999);
  });

  it("rechaza montos inválidos", () => {
    expect(() => parseDollarsToCents("abc")).toThrow();
    expect(() => parseDollarsToCents("")).toThrow();
    expect(() => parseDollarsToCents("1.234")).toThrow();
  });

  it("convierte centavos a string de dólares", () => {
    expect(centsToDollarsString(30000)).toBe("300.00");
    expect(centsToDollarsString(1)).toBe("0.01");
  });
});
