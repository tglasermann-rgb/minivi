import { describe, expect, it } from "vitest";
import { formatSku, isValidSku, parseSku, slugify, variantSuffix } from "./sku";

describe("SKU", () => {
  it("formatea con 4 dígitos y código por tipo", () => {
    expect(formatSku("necklace", 1)).toBe("MV-NK-0001");
    expect(formatSku("bracelet", 42)).toBe("MV-BR-0042");
    expect(formatSku("earring", 7)).toBe("MV-ER-0007");
    expect(formatSku("ring", 1234)).toBe("MV-RG-1234");
    expect(formatSku("charm", 3)).toBe("MV-CH-0003");
    expect(formatSku("pendant", 10000)).toBe("MV-PD-10000");
  });

  it("agrega sufijo de variante para largos y tallas", () => {
    expect(formatSku("necklace", 1, "16")).toBe("MV-NK-0001-16");
    expect(formatSku("necklace", 1, '18"')).toBe("MV-NK-0001-18");
    expect(formatSku("necklace", 1, "20 in")).toBe("MV-NK-0001-20");
    expect(formatSku("ring", 5, "6")).toBe("MV-RG-0005-6");
    expect(formatSku("ring", 5, "6.5")).toBe("MV-RG-0005-6.5");
    expect(formatSku("ring", 5, null)).toBe("MV-RG-0005");
  });

  it("rechaza números inválidos", () => {
    expect(() => formatSku("ring", 0)).toThrow();
    expect(() => formatSku("ring", 1.5)).toThrow();
  });

  it("parsea SKUs con y sin variante", () => {
    expect(parseSku("MV-NK-0001")).toEqual({ typeCode: "NK", type: "necklace", number: 1, suffix: null, base: "MV-NK-0001" });
    expect(parseSku("mv-rg-0005-6.5")).toEqual({ typeCode: "RG", type: "ring", number: 5, suffix: "6.5", base: "MV-RG-0005" });
    expect(() => parseSku("MV-XX-0001")).toThrow();
    expect(() => parseSku("NK-0001")).toThrow();
    expect(isValidSku("MV-BR-0042")).toBe(true);
    expect(isValidSku("MV-BR-42")).toBe(false);
  });

  it("variantSuffix limpia unidades", () => {
    expect(variantSuffix("16")).toBe("16");
    expect(variantSuffix(" 18 inches ")).toBe("18");
    expect(variantSuffix("")).toBeNull();
    expect(variantSuffix(undefined)).toBeNull();
  });

  it("slugify genera handles estables", () => {
    expect(slugify("Cuban Link Chain 3mm")).toBe("cuban-link-chain-3mm");
    expect(slugify("  Corazón   dorado! ")).toBe("corazon-dorado");
    expect(slugify("")).toBe("product");
  });
});
