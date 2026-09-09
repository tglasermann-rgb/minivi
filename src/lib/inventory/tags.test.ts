import { describe, expect, it } from "vitest";
import { assertPublicText, buildTags, hasForbiddenPublicText } from "./tags";

describe("tags de Shopify", () => {
  it("arma tipo + subcategoría + extras + kilataje + real-gold", () => {
    expect(buildTags("necklace", "chains", ["bestseller", "new"], "14k")).toEqual(["necklace", "chains", "new", "bestseller", "14k", "real-gold"]);
    expect(buildTags("ring", "bands", [], "14k")).toEqual(["ring", "bands", "14k", "real-gold"]);
  });
  it("rechaza subcategorías o extras inválidos", () => {
    expect(() => buildTags("ring", "rings", [], "14k")).toThrow();
    expect(() => buildTags("ring", "bands", ["sale"], "14k")).toThrow();
  });
});

describe("textos públicos", () => {
  it("prohíbe solid gold", () => {
    expect(() => assertPublicText("Real 14k gold, stamped, no plating")).not.toThrow();
    expect(() => assertPublicText("Solid Gold cuban chain", "título")).toThrow(/solid gold/i);
    expect(hasForbiddenPublicText("14k SOLID  gold")).toBe(true);
    expect(hasForbiddenPublicText("oro sólido")).toBe(true);
  });
});
