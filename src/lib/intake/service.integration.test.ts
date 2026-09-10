import { beforeAll, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => ({ id: "00000000-0000-0000-0000-000000000001", email: "test@minivi.test", fullName: null, role: "owner" }) }));
vi.mock("@/lib/settings", () => ({
  getSettings: async () => ({
    precio_por_gramo: 30000, redondeo_precio: 500, costo_por_gramo_default: 10000, kilataje_default: "14k",
    semana_inicia: "monday", overtime_umbral_horas: 40, tienda_timezone: "America/New_York",
    drive_root_folder_id: "", shopify_location_id: "",
  }),
}));
vi.mock("@/lib/prisma", async () => {
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("@/generated/prisma/client");
  return { prisma: new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL ?? "" }) }) };
});

const día = (offset: number) => {
  const d = new Date("2026-09-10T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};

/** Pieza nueva mínima, para no repetir los mismos campos en cada prueba. */
const nueva = (over: Record<string, unknown>) => ({
  mode: "new" as const, type: "bracelet" as const, subcategory: "bangles", extraTags: [], karat: "14k",
  descriptionHtml: "<p>Real 14k gold, stamped 14k. No plating.</p>", priceOverride: false, status: "draft" as const,
  qty: 1, premiumCents: 0, ...over,
}) as never;

describe.skipIf(!url)("entrada de mercadería (integración)", () => {
  let svc: typeof import("./service");
  let prisma: typeof import("@/lib/prisma").prisma;
  let supplierId: string;

  beforeAll(async () => {
    svc = await import("./service");
    prisma = (await import("@/lib/prisma")).prisma;
    await prisma.payable.deleteMany(); await prisma.purchaseItem.deleteMany(); await prisma.purchase.deleteMany(); await prisma.supplier.deleteMany();
    await prisma.stockMovement.deleteMany(); await prisma.productImage.deleteMany(); await prisma.product.deleteMany(); await prisma.skuCounter.deleteMany();
    supplierId = (await prisma.supplier.create({ data: { name: "Gold Supplier Inc" } })).id;
  });

  it("carga la factura y las piezas quedan en inventario con stock", async () => {
    const r = await svc.registerIntake({
      supplierId, date: día(0), invoiceNumber: "A-4471", costPerGramCents: 9500,
      taxCents: 0, shippingCents: 0, payments: [{ amountCents: 0, dueOn: día(30) }],
      lines: [
        nueva({ title: "Miami Cuban Bracelet 5mm", grams: 10, premiumCents: 1000, qty: 2 }),
        nueva({ title: "Rope Bracelet 4mm", grams: 10, premiumCents: 1200, qty: 1 }),
        nueva({ title: "Figaro Chain 3mm", type: "necklace", subcategory: "chains", grams: 10, premiumCents: 0, qty: 1 }),
      ],
    // Las fechas tienen que sumar el total: acá se corrige abajo con checkPayments.
    }).catch((e: Error) => e);
    // La factura da 105000×2 + 107000 + 95000 = 412000 y el pago decía 0.
    expect(r).toBeInstanceOf(Error);
    expect((r as Error).message).toMatch(/Las fechas de pago suman/);
  });

  it("una sola fecha por el total: crea piezas, SKU, precio y stock", async () => {
    const total = 105000 * 2 + 107000 + 95000;
    const r = await svc.registerIntake({
      supplierId, date: día(0), invoiceNumber: "A-4471", costPerGramCents: 9500,
      taxCents: 0, shippingCents: 0, payments: [{ amountCents: total, dueOn: día(30) }],
      lines: [
        nueva({ title: "Miami Cuban Bracelet 5mm", grams: 10, premiumCents: 1000, qty: 2 }),
        nueva({ title: "Rope Bracelet 4mm", grams: 10, premiumCents: 1200, qty: 1 }),
        nueva({ title: "Figaro Chain 3mm", type: "necklace", subcategory: "chains", grams: 10, premiumCents: 0, qty: 1 }),
      ],
    });

    expect(r.created).toHaveLength(3);
    expect(r.restocked).toHaveLength(0);
    expect(r.totalCents).toBe(total);

    const compra = await prisma.purchase.findUniqueOrThrow({ where: { id: r.purchaseId }, include: { items: { orderBy: { position: "asc" } }, payables: true } });
    expect(compra.status).toBe("received");
    expect(compra.payables).toHaveLength(1);
    expect(compra.payables[0].amountCents).toBe(total);
    // Tres líneas, cada una con su "+" sobre la base de 95: +10, +12 y sin +.
    expect(compra.items.map((i) => i.unitCostCents)).toEqual([105000, 107000, 95000]);
    expect(compra.items.map((i) => i.qty)).toEqual([2, 1, 1]);
    expect(compra.subtotalCents).toBe(105000 * 2 + 107000 + 95000);

    const cuban = await prisma.product.findFirstOrThrow({ where: { title: "Miami Cuban Bracelet 5mm" } });
    expect(cuban.sku).toBe("MV-BR-0001");
    expect(cuban.costCents).toBe(105000);       // 10 g × (95 + 10)
    expect(cuban.priceCents).toBe(300000);      // 10 g × $300/g
    const stock = await prisma.stockMovement.aggregate({ where: { productId: cuban.id }, _sum: { qty: true } });
    expect(stock._sum.qty).toBe(2);
    // La línea queda atada a la pieza que creó.
    expect(compra.items[0].productId).toBe(cuban.id);
  });

  it("reponer suma stock a la pieza que ya existe, sin crear un SKU nuevo", async () => {
    const antes = await prisma.product.findFirstOrThrow({ where: { title: "Rope Bracelet 4mm" } });
    const skusAntes = await prisma.product.count();

    const unidad = 10 * (10000 + 1200); // base 100 con +12
    const r = await svc.registerIntake({
      supplierId, date: día(5), invoiceNumber: "A-4480", costPerGramCents: 10000,
      taxCents: 0, shippingCents: 0, payments: [{ amountCents: unidad * 3, dueOn: día(35) }],
      lines: [{ mode: "restock", productId: antes.id, qty: 3, premiumCents: 1200, updateExisting: true }],
    });

    expect(r.created).toHaveLength(0);
    expect(r.restocked).toEqual([{ sku: antes.sku, title: antes.title, qty: 3, repriced: true }]);
    expect(await prisma.product.count()).toBe(skusAntes);

    const después = await prisma.product.findUniqueOrThrow({ where: { id: antes.id } });
    expect(después.sku).toBe(antes.sku);
    expect(después.costCents).toBe(112000);   // 10 g × (100 + 12), actualizado
    expect(después.priceCents).toBe(300000);  // el precio sigue la fórmula de hoy
    const stock = await prisma.stockMovement.aggregate({ where: { productId: antes.id }, _sum: { qty: true } });
    expect(stock._sum.qty).toBe(4);           // 1 de la primera entrada + 3 de la reposición
  });

  it("sin actualizar, la pieza vieja conserva su costo", async () => {
    const antes = await prisma.product.findFirstOrThrow({ where: { title: "Figaro Chain 3mm" } });
    expect(antes.costCents).toBe(95000);

    const unidad = 10 * (12000 + 2000);
    const r = await svc.registerIntake({
      supplierId, date: día(6), costPerGramCents: 12000,
      taxCents: 0, shippingCents: 0, payments: [{ amountCents: unidad, dueOn: día(36) }],
      lines: [{ mode: "restock", productId: antes.id, qty: 1, premiumCents: 2000, updateExisting: false }],
    });

    expect(r.restocked[0].repriced).toBe(false);
    const después = await prisma.product.findUniqueOrThrow({ where: { id: antes.id } });
    expect(después.costCents).toBe(95000);
    // La línea de la factura sí guarda lo que costó esta vez.
    const item = await prisma.purchaseItem.findFirstOrThrow({ where: { purchaseId: r.purchaseId } });
    expect(item.unitCostCents).toBe(140000);
  });

  it("una pieza con precio manual no se repone al precio de la fórmula", async () => {
    const p = await prisma.product.findFirstOrThrow({ where: { title: "Miami Cuban Bracelet 5mm" } });
    await prisma.product.update({ where: { id: p.id }, data: { priceOverride: true, priceCents: 275000 } });

    const unidad = 10 * (10000 + 1000);
    await svc.registerIntake({
      supplierId, date: día(7), costPerGramCents: 10000,
      taxCents: 0, shippingCents: 0, payments: [{ amountCents: unidad, dueOn: día(37) }],
      lines: [{ mode: "restock", productId: p.id, qty: 1, premiumCents: 1000, updateExisting: true }],
    });

    const después = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(después.costCents).toBe(110000);   // el costo sí se actualiza
    expect(después.priceCents).toBe(275000);  // el precio manual no se pisa
  });

  it("mezcla piezas nuevas y reposiciones en la misma factura, con impuestos y envío", async () => {
    const existente = await prisma.product.findFirstOrThrow({ where: { title: "Figaro Chain 3mm" } });
    const nuevaUnidad = 8 * (9000 + 800);   // 8 g a base 90 con +8
    const reposicion = 10 * (9000 + 0);
    const subtotal = nuevaUnidad * 2 + reposicion;
    const total = subtotal + 1500 + 2500;

    const r = await svc.registerIntake({
      supplierId, date: día(10), costPerGramCents: 9000, taxCents: 1500, shippingCents: 2500,
      payments: [{ amountCents: 50000, dueOn: día(20) }, { amountCents: total - 50000, dueOn: día(50) }],
      lines: [
        nueva({ title: "Herringbone Bracelet 6mm", grams: 8, premiumCents: 800, qty: 2 }),
        { mode: "restock", productId: existente.id, qty: 1, premiumCents: 0, updateExisting: false },
      ],
    });

    expect(r.created).toHaveLength(1);
    expect(r.restocked).toHaveLength(1);
    expect(r.totalCents).toBe(total);
    const compra = await prisma.purchase.findUniqueOrThrow({ where: { id: r.purchaseId }, include: { payables: { orderBy: { dueOn: "asc" } } } });
    expect(compra.subtotalCents).toBe(subtotal);
    expect(compra.payables.map((x) => x.amountCents)).toEqual([50000, total - 50000]);
  });

  it("un costo cerrado manda sobre la cuenta por gramo", async () => {
    const r = await svc.registerIntake({
      supplierId, date: día(12), costPerGramCents: 9000,
      taxCents: 0, shippingCents: 0, payments: [{ amountCents: 50000, dueOn: día(12) }],
      lines: [nueva({ title: "Heart Pendant", type: "pendant", subcategory: "pendants", grams: 10, premiumCents: 2000, qty: 1, unitCostCents: 50000 })],
    });
    const item = await prisma.purchaseItem.findFirstOrThrow({ where: { purchaseId: r.purchaseId } });
    expect(item.unitCostCents).toBe(50000);
    expect(item.unitCostOverride).toBe(true);
    expect(item.premiumCents).toBe(2000); // queda anotado aunque no se aplique
    const prod = await prisma.product.findFirstOrThrow({ where: { title: "Heart Pendant" } });
    expect(prod.costCents).toBe(50000);
  });

  it("rechaza una entrada sin piezas o con cantidad cero", async () => {
    await expect(svc.registerIntake({
      supplierId, date: día(1), costPerGramCents: 9000, taxCents: 0, shippingCents: 0, payments: [], lines: [],
    })).rejects.toThrow(/al menos una pieza/);

    await expect(svc.registerIntake({
      supplierId, date: día(1), costPerGramCents: 9000, taxCents: 0, shippingCents: 0, payments: [],
      lines: [nueva({ title: "Test Bracelet", grams: 5, qty: 0 })],
    })).rejects.toThrow(/cantidad mayor a cero/);
  });

  it("busca piezas para reponer por SKU y por título", async () => {
    const porTítulo = await svc.searchProductsForRestock("figaro");
    expect(porTítulo.map((x) => x.title)).toContain("Figaro Chain 3mm");
    const porSku = await svc.searchProductsForRestock("MV-BR-0001");
    expect(porSku).toHaveLength(1);
    expect(porSku[0].grams).toBe(10);
  });
});
