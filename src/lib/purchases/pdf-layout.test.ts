import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { poColumns } = await import("./pdf");

describe("columnas de la orden de compra", () => {
  const M = 48;
  const PAGE = 612;
  const cols = poColumns(M);

  it("ninguna columna pisa a la siguiente", () => {
    for (let i = 0; i < cols.length - 1; i++) {
      const fin = cols[i].x + cols[i].w;
      expect(fin, `"${cols[i].label}" se mete en "${cols[i + 1].label}"`).toBeLessThanOrEqual(cols[i + 1].x);
    }
  });

  it("la tabla entra en la hoja y termina en el margen derecho", () => {
    const ultima = cols[cols.length - 1];
    expect(cols[0].x).toBe(M);
    expect(ultima.x + ultima.w).toBe(PAGE - M);
  });

  it('la columna del "+" existe y tiene lugar para un valor de dos dígitos', () => {
    const mas = cols.find((c) => c.label === "+/g");
    expect(mas).toBeDefined();
    // A 9pt, "+12" mide unos 15pt en Helvetica: entra con margen de sobra.
    expect(mas!.w).toBeGreaterThanOrEqual(30);
  });
});
