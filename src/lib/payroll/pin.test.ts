import { describe, expect, it } from "vitest";
import { hashPin, verifyPin } from "./pin";

describe("PIN", () => {
  it("hashea y verifica", () => {
    const h = hashPin("1234");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(verifyPin("1234", h)).toBe(true);
    expect(verifyPin("1235", h)).toBe(false);
    expect(verifyPin("1234", "garbage")).toBe(false);
  });
  it("exige 4 dígitos", () => {
    expect(() => hashPin("12")).toThrow();
    expect(() => hashPin("abcd")).toThrow();
  });
});
