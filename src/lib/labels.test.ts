import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { PDFDocument } from "pdf-lib";
import { LABEL_HEIGHT_PT, LABEL_WIDTH_PT, buildLabelsPdf } from "./labels";

describe("etiquetas PDF", () => {
  it("genera una página de 2.2×0.5 pulgadas por etiqueta y por copia", async () => {
    const bytes = await buildLabelsPdf(
      [{ sku: "MV-NK-0001", priceCents: 63000, grams: 2.1, karat: "14k" }, { sku: "MV-RG-0005-7", priceCents: 24900, grams: 0.83, karat: "14k" }],
      { copies: 2 },
    );
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(4);
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBeCloseTo(LABEL_WIDTH_PT, 3);
    expect(height).toBeCloseTo(LABEL_HEIGHT_PT, 3);
    expect(width / 72).toBeCloseTo(2.2, 5);
    expect(height / 72).toBeCloseTo(0.5, 5);
  });
});
