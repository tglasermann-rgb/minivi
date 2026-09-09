/**
 * Test de integración contra Postgres real. Corre solo si TEST_DATABASE_URL está definida:
 *   TEST_DATABASE_URL=postgresql://postgres@localhost:5499/minivi npx vitest run service.integration
 */
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

describe.skipIf(!url)("inventario (integración)", () => {
  let svc: typeof import("./service");
  let prisma: typeof import("@/lib/prisma").prisma;

  beforeAll(async () => {
    svc = await import("./service");
    prisma = (await import("@/lib/prisma")).prisma;
    await prisma.stockMovement.deleteMany();
    await prisma.productImage.deleteMany();
    await prisma.product.deleteMany();
    await prisma.skuCounter.deleteMany();
    await prisma.auditLog.deleteMany();
  });

  it("genera SKUs consecutivos por tipo y precio automático", async () => {
    const a = await svc.createProduct({ title: "Cuban Chain", type: "necklace", subcategory: "chains", extraTags: ["new"], karat: "14k", grams: 2.1, descriptionHtml: "<p>Real 14k gold</p>", priceOverride: false, initialQty: 3 });
    const b = await svc.createProduct({ title: "Rope Chain", type: "necklace", subcategory: "chains", extraTags: [], karat: "14k", grams: 1.15, descriptionHtml: "", priceOverride: false });
    const r = await svc.createProduct({ title: "Band Ring", type: "ring", subcategory: "bands", extraTags: [], karat: "14k", grams: 0.83, descriptionHtml: "", priceOverride: true, priceCents: 24900, optionValue: "7" });
    expect(a.sku).toBe("MV-NK-0001");
    expect(b.sku).toBe("MV-NK-0002");
    expect(r.sku).toBe("MV-RG-0001-7");
    expect(a.priceCents).toBe(63000);
    expect(a.costCents).toBe(21000);
    expect(b.priceCents).toBe(34500);
    expect(r.priceCents).toBe(24900);
    expect(await svc.getStock(a.id)).toBe(3);
    expect(await svc.getStock(b.id)).toBe(0);
  });

  it("las variantes comparten número y handle", async () => {
    const base = await prisma.product.findFirstOrThrow({ where: { sku: "MV-NK-0001" } });
    const v16 = await svc.createProduct({ title: "x", type: "necklace", subcategory: "chains", extraTags: [], karat: "14k", grams: 2.0, descriptionHtml: "", priceOverride: false, variantOfId: base.id, optionValue: "16" });
    const v18 = await svc.createProduct({ title: "x", type: "necklace", subcategory: "chains", extraTags: [], karat: "14k", grams: 2.4, descriptionHtml: "", priceOverride: false, variantOfId: base.id, optionValue: "18" });
    expect(v16.sku).toBe("MV-NK-0001-16");
    expect(v18.sku).toBe("MV-NK-0001-18");
    expect(v16.handle).toBe(base.handle);
    await expect(svc.createProduct({ title: "x", type: "necklace", subcategory: "chains", extraTags: [], karat: "14k", grams: 2.0, descriptionHtml: "", priceOverride: false, variantOfId: base.id, optionValue: "16" })).rejects.toThrow(/Ya existe/);
  });

  it("rechaza solid gold y subcategorías inválidas", async () => {
    await expect(svc.createProduct({ title: "Solid gold chain", type: "necklace", subcategory: "chains", extraTags: [], karat: "14k", grams: 1, descriptionHtml: "", priceOverride: false })).rejects.toThrow(/solid gold/i);
    await expect(svc.createProduct({ title: "ok", type: "necklace", subcategory: "nope", extraTags: [], karat: "14k", grams: 1, descriptionHtml: "", priceOverride: false })).rejects.toThrow(/Subcategoría/);
  });

  it("stock por movimientos y audit_log", async () => {
    const a = await prisma.product.findFirstOrThrow({ where: { sku: "MV-NK-0001" } });
    await svc.addStockMovement({ productId: a.id, qty: -1, reason: "sale", reference: "#1001" });
    await svc.addStockMovement({ productId: a.id, qty: 2, reason: "purchase", reference: "PO-1" });
    expect(await svc.getStock(a.id)).toBe(4);
    await expect(svc.addStockMovement({ productId: a.id, qty: 0, reason: "adjustment" })).rejects.toThrow();
    const logs = await prisma.auditLog.findMany({ where: { entity: "stock_movements" } });
    expect(logs.length).toBe(2);
    expect(logs.every((l) => l.userEmail === "test@minivi.test")).toBe(true);
  });

  it("updateProduct recalcula precio, mantiene costo por gramo y no cambia el tipo", async () => {
    const b = await prisma.product.findFirstOrThrow({ where: { sku: "MV-NK-0002" } });
    const after = await svc.updateProduct(b.id, { grams: 2.3 });
    expect(after.priceCents).toBe(69000);
    expect(after.costCents).toBe(23000);
    await expect(svc.updateProduct(b.id, { type: "ring" })).rejects.toThrow(/inmutable/);
    const manual = await svc.updateProduct(b.id, { priceOverride: true, priceCents: 59900 });
    expect(manual.priceCents).toBe(59900);
  });

  it("repriceAll respeta overrides", async () => {
    const changed = await svc.repriceAll();
    expect(changed).toBe(0); // ya están al día
    await prisma.product.updateMany({ where: { priceOverride: false }, data: { priceCents: 1 } });
    const changed2 = await svc.repriceAll();
    expect(changed2).toBeGreaterThan(0);
    const manual = await prisma.product.findFirstOrThrow({ where: { sku: "MV-NK-0002" } });
    expect(manual.priceCents).toBe(59900);
  });
});
