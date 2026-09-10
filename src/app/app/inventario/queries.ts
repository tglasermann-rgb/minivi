import "server-only";
import { prisma } from "@/lib/prisma";
import { getStockMap } from "@/lib/inventory/service";
import type { Prisma, ProductStatus, ProductType } from "@/generated/prisma/client";

export type InventoryFilters = {
  q?: string;
  type?: ProductType | "";
  subcategory?: string;
  status?: ProductStatus | "";
  photo?: "with" | "without" | "";
  shopify?: "with" | "without" | "";
  stock?: "in" | "out" | "";
};

export type ProductRow = {
  id: string;
  sku: string;
  title: string;
  type: ProductType;
  subcategory: string;
  karat: string;
  grams: number;
  costCents: number;
  priceCents: number;
  priceOverride: boolean;
  status: ProductStatus;
  optionValue: string | null;
  stock: number;
  imageUrl: string | null;
  imageCount: number;
  shopifyProductId: string | null;
  handle: string;
};

export async function listProducts(f: InventoryFilters) {
  const where: Prisma.ProductWhereInput = {};
  if (f.q) where.OR = [{ sku: { contains: f.q, mode: "insensitive" } }, { title: { contains: f.q, mode: "insensitive" } }];
  if (f.type) where.type = f.type;
  if (f.subcategory) where.subcategory = f.subcategory;
  if (f.status) where.status = f.status;
  else where.status = { not: "archived" };
  if (f.photo === "with") where.images = { some: {} };
  if (f.photo === "without") where.images = { none: {} };
  if (f.shopify === "with") where.shopifyProductId = { not: null };
  if (f.shopify === "without") where.shopifyProductId = null;

  const products = await prisma.product.findMany({
    where,
    include: { images: { orderBy: { position: "asc" }, take: 1 }, _count: { select: { images: true } } },
    orderBy: [{ createdAt: "desc" }],
    take: 500,
  });
  const stock = await getStockMap(products.map((p) => p.id));

  let rows: ProductRow[] = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    title: p.title,
    type: p.type,
    subcategory: p.subcategory,
    karat: p.karat,
    grams: Number(p.grams),
    costCents: p.costCents,
    priceCents: p.priceCents,
    priceOverride: p.priceOverride,
    status: p.status,
    optionValue: p.optionValue,
    stock: stock.get(p.id) ?? 0,
    imageUrl: p.images[0]?.publicUrl ?? null,
    imageCount: p._count.images,
    shopifyProductId: p.shopifyProductId,
    handle: p.handle,
  }));
  if (f.stock === "in") rows = rows.filter((r) => r.stock > 0);
  if (f.stock === "out") rows = rows.filter((r) => r.stock <= 0);

  const totals = rows.reduce(
    (acc, r) => {
      const units = Math.max(0, r.stock);
      acc.pieces += units;
      acc.skus += 1;
      acc.grams += r.grams * units;
      acc.costCents += r.costCents * units;
      acc.priceCents += r.priceCents * units;
      return acc;
    },
    { pieces: 0, skus: 0, grams: 0, costCents: 0, priceCents: 0 },
  );
  return { rows, totals };
}

export async function getProductDetail(id: string) {
  const p = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { position: "asc" } },
      movements: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!p) return null;
  const stock = p.movements.reduce((s, m) => s + m.qty, 0);
  const siblings = await prisma.product.findMany({ where: { handle: p.handle, id: { not: p.id } }, select: { id: true, sku: true, optionValue: true }, orderBy: { sku: "asc" } });
  return { ...p, grams: Number(p.grams), stock, siblings };
}

export async function listBaseProducts() {
  return prisma.product.findMany({
    where: { status: { not: "archived" } },
    select: { id: true, sku: true, title: true, type: true, optionName: true, optionValue: true, handle: true },
    orderBy: { sku: "asc" },
    take: 1000,
  });
}
