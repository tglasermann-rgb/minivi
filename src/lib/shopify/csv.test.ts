import { describe, expect, it } from "vitest";
import { SHOPIFY_CSV_HEADERS, buildShopifyCsv } from "./csv";

const base = {
  handle: "cuban-chain-0001", title: "Cuban Chain", descriptionHtml: "<p>Real 14k gold</p>", type: "necklace", subcategory: "chains",
  extraTags: ["new"], karat: "14k", grams: 2.1, sku: "MV-NK-0001-16", optionName: "Length", optionValue: "16", stock: 3,
  priceCents: 63000, costCents: 21000, status: "active" as const, images: ["https://x/a.jpg", "https://x/b.jpg"],
};

describe("CSV de Shopify", () => {
  it("tiene las columnas exactas del importador", () => {
    expect(SHOPIFY_CSV_HEADERS).toHaveLength(23);
    expect(SHOPIFY_CSV_HEADERS[0]).toBe("Handle");
    expect(SHOPIFY_CSV_HEADERS[22]).toBe("Status");
  });

  it("agrupa variantes por handle y agrega filas de imagen", () => {
    const csv = buildShopifyCsv([base, { ...base, sku: "MV-NK-0001-18", optionValue: "18", stock: 1 }]);
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(1 + 2 + 1); // header + 2 variantes + 1 imagen extra
    expect(lines[1]).toContain("cuban-chain-0001,Cuban Chain,<p>Real 14k gold</p>,MiniVi,Necklace,");
    expect(lines[1]).toContain('"necklace, chains, new, 14k, real-gold"');
    expect(lines[1]).toContain("Length,16,MV-NK-0001-16,2.10,shopify,3,deny,manual,630.00,TRUE,TRUE,https://x/a.jpg,1,g,210.00,active");
    expect(lines[2].startsWith("cuban-chain-0001,,,,,,,Length,18,MV-NK-0001-18")).toBe(true);
    expect(lines[3]).toBe("cuban-chain-0001,,,,,,,,,,,,,,,,,,https://x/b.jpg,2,,,");
  });

  it("producto sin variantes usa Title / Default Title", () => {
    const csv = buildShopifyCsv([{ ...base, optionName: null, optionValue: null, sku: "MV-NK-0002", images: [] }]);
    expect(csv.split("\r\n")[1]).toContain(",Title,Default Title,MV-NK-0002,");
  });
});
