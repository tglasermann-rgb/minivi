import { beforeAll, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => ({ id: "00000000-0000-0000-0000-000000000001", email: "test@minivi.test", fullName: null, role: "owner" }) }));
vi.mock("@/lib/settings", () => ({
  getSettings: async () => ({ precio_por_gramo: 30000, redondeo_precio: 500, costo_por_gramo_default: 10000, kilataje_default: "14k", semana_inicia: "monday", overtime_umbral_horas: 40, tienda_timezone: "America/New_York", drive_root_folder_id: "", shopify_location_id: "" }),
}));
vi.mock("@/lib/prisma", async () => {
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("@/generated/prisma/client");
  return { prisma: new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL ?? "" }) }) };
});

describe.skipIf(!url)("compras (integración)", () => {
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

  it("crea una compra a $100/g con 30/60/90 y tres cuotas", async () => {
    const items = Array.from({ length: 4 }, (_, i) => ({ description: `Cuban Chain ${i + 1}`, type: "necklace" as const, subcategory: "chains", karat: "14k", grams: 2 + i, qty: 5 }));
    const p = await svc.createPurchase({ supplierId, date: new Date("2026-09-01T00:00:00Z"), costPerGramCents: 10000, taxCents: 0, shippingCents: 5000, paymentTerms: "30_60_90", items });
    const full = await prisma.purchase.findUniqueOrThrow({ where: { id: p.id }, include: { items: true, payables: true } });
    // 5×(200+300+400+500) = 7000 → 700000 + 5000 envío
    expect(full.subtotalCents).toBe(700000);
    expect(full.totalCents).toBe(705000);
    expect(full.payables).toHaveLength(3);
    expect(full.payables.reduce((s, x) => s + x.amountCents, 0)).toBe(705000);
    expect(full.items[0].unitCostCents).toBe(20000);
  });

  it("recibe parcial y crea productos con stock; luego completa", async () => {
    const p = await prisma.purchase.findFirstOrThrow({ include: { items: { orderBy: { position: "asc" } } } });
    const r1 = await svc.receivePurchase(p.id, [{ itemId: p.items[0].id, qty: 2 }, { itemId: p.items[1].id, qty: 5 }]);
    expect(r1.status).toBe("ordered");
    expect(r1.results.filter((x) => x.created)).toHaveLength(2);
    const prod = await prisma.product.findFirstOrThrow({ where: { purchaseItemId: p.items[0].id } });
    expect(prod.sku).toBe("MV-NK-0001");
    expect(prod.costCents).toBe(20000);
    expect(prod.priceCents).toBe(60000);
    const stock = await prisma.stockMovement.aggregate({ where: { productId: prod.id }, _sum: { qty: true } });
    expect(stock._sum.qty).toBe(2);

    await expect(svc.receivePurchase(p.id, [{ itemId: p.items[0].id, qty: 4 }])).rejects.toThrow(/pendientes/);
    const r2 = await svc.receivePurchase(p.id, [{ itemId: p.items[0].id, qty: 3 }, { itemId: p.items[2].id, qty: 5 }, { itemId: p.items[3].id, qty: 5 }]);
    expect(r2.status).toBe("received");
    const stock2 = await prisma.stockMovement.aggregate({ where: { productId: prod.id }, _sum: { qty: true } });
    expect(stock2._sum.qty).toBe(5);
    const count = await prisma.product.count();
    expect(count).toBe(4);
  });

  it("marcar cuotas pagadas cierra la compra; costo promedio por gramo", async () => {
    const p = await prisma.purchase.findFirstOrThrow({ include: { payables: true } });
    for (const x of p.payables) await svc.markPayablePaid(x.id, { paidOn: new Date("2026-10-01T00:00:00Z"), method: "transfer" });
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("closed");
    await svc.unmarkPayablePaid(p.payables[0].id);
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("received");

    const avg = await svc.inventoryAverageCostPerGram();
    expect(avg.pieces).toBe(20);
    expect(avg.grams).toBe(5 * (2 + 3 + 4 + 5));
    expect(avg.avgCentsPerGram).toBe(10000);
  });

  it("no edita compras con recepciones", async () => {
    const p = await prisma.purchase.findFirstOrThrow();
    await expect(svc.updatePurchase(p.id, { supplierId, date: new Date(), costPerGramCents: 1, taxCents: 0, shippingCents: 0, paymentTerms: "contado", items: [] })).rejects.toThrow();
  });
});
