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
  const d = new Date("2026-09-01T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};

describe.skipIf(!url)("ciclo de pago de una compra (integración)", () => {
  let svc: typeof import("./service");
  let prisma: typeof import("@/lib/prisma").prisma;
  let purchaseId: string;

  beforeAll(async () => {
    svc = await import("./service");
    prisma = (await import("@/lib/prisma")).prisma;
    const intake = await import("@/lib/intake/service");
    await prisma.payable.deleteMany(); await prisma.purchaseItem.deleteMany(); await prisma.purchase.deleteMany(); await prisma.supplier.deleteMany();
    await prisma.stockMovement.deleteMany(); await prisma.productImage.deleteMany(); await prisma.product.deleteMany(); await prisma.skuCounter.deleteMany();
    const supplierId = (await prisma.supplier.create({ data: { name: "Gold Supplier Inc" } })).id;

    // Cuatro cadenas de 2, 3, 4 y 5 g a $100/g, cinco unidades cada una: $7,000.
    const total = 5 * (20000 + 30000 + 40000 + 50000);
    const cuota = Math.round(total / 4);
    const r = await intake.registerIntake({
      supplierId, date: día(0), costPerGramCents: 10000, taxCents: 0, shippingCents: 0,
      payments: [
        { amountCents: cuota, dueOn: día(30) },
        { amountCents: cuota, dueOn: día(60) },
        { amountCents: total - 2 * cuota, dueOn: día(90) },
      ],
      lines: [2, 3, 4, 5].map((g, i) => ({
        mode: "new" as const, title: `Cuban Chain ${i + 1}`, type: "necklace" as const, subcategory: "chains",
        extraTags: [], karat: "14k", grams: g, descriptionHtml: "<p>Real 14k gold, stamped 14k. No plating.</p>",
        priceOverride: false, status: "draft" as const, qty: 5, premiumCents: 0,
      })),
    });
    purchaseId = r.purchaseId;
  });

  it("pagar todas las cuotas cierra la compra, y despagar la reabre", async () => {
    const p = await prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId }, include: { payables: true } });
    expect(p.status).toBe("received");
    expect(p.payables).toHaveLength(3);
    expect(p.payables.reduce((s, x) => s + x.amountCents, 0)).toBe(700000);

    for (const x of p.payables) await svc.markPayablePaid(x.id, { paidOn: día(95), method: "transfer" });
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } })).status).toBe("closed");

    await svc.unmarkPayablePaid(p.payables[0].id);
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } })).status).toBe("received");
  });

  it("costo promedio por gramo del inventario en stock", async () => {
    const avg = await svc.inventoryAverageCostPerGram();
    expect(avg.pieces).toBe(20);
    expect(avg.grams).toBe(5 * (2 + 3 + 4 + 5));
    expect(avg.avgCentsPerGram).toBe(10000);
  });

  it("cuentas por pagar próximas trae solo las que faltan pagar", async () => {
    const próximas = await svc.upcomingPayables(3650);
    expect(próximas.length).toBeGreaterThan(0);
    expect(próximas.every((x) => !x.paidOn)).toBe(true);
  });
});
