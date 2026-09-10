import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { checkPayments, lineUnitCost } = await import("./service");

const día = (n: number) => new Date(`2026-09-${String(n).padStart(2, "0")}T00:00:00Z`);

describe("fechas de pago de una entrada", () => {
  it("sin fechas, todo el total el día de la factura", () => {
    expect(checkPayments([], 412000, día(10))).toEqual([{ amountCents: 412000, dueOn: día(10) }]);
  });

  it("varias fechas que suman el total pasan tal cual", () => {
    const pagos = [
      { amountCents: 200000, dueOn: día(20) },
      { amountCents: 212000, dueOn: día(30) },
    ];
    expect(checkPayments(pagos, 412000, día(10))).toEqual(pagos);
  });

  it("si no suman el total, avisa con los dos números", () => {
    expect(() => checkPayments([{ amountCents: 100000, dueOn: día(20) }], 412000, día(10)))
      .toThrow(/suman 1000.00 y la factura da 4120.00/);
  });

  it("una fecha en cero no sirve: quedaría una cuenta por pagar fantasma", () => {
    expect(() => checkPayments([{ amountCents: 0, dueOn: día(20) }, { amountCents: 412000, dueOn: día(30) }], 412000, día(10)))
      .toThrow(/monto mayor a cero/);
  });
});

describe("costo unitario de una pieza de la entrada", () => {
  it("gramos por la base más el + de esa pieza", () => {
    expect(lineUnitCost(9500, 10, 0)).toBe(95000);
    expect(lineUnitCost(9500, 10, 1000)).toBe(105000);
    expect(lineUnitCost(9500, 10, 1200)).toBe(107000);
    expect(lineUnitCost(9500, 8.35, 1200)).toBe(89345);
  });

  it("un costo cerrado manda sobre la cuenta por gramo", () => {
    expect(lineUnitCost(9500, 10, 2000, 50000)).toBe(50000);
    // Cero es un costo cerrado válido: mercadería que vino sin cargo.
    expect(lineUnitCost(9500, 10, 2000, 0)).toBe(0);
  });

  it("sin costo cerrado, null y undefined caen en la cuenta normal", () => {
    expect(lineUnitCost(10000, 5, 0, null)).toBe(50000);
    expect(lineUnitCost(10000, 5, 0, undefined)).toBe(50000);
  });
});
