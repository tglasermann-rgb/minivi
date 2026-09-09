import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStockMap } from "@/lib/inventory/service";
import { buildShopifyCsv, type CsvProduct } from "@/lib/shopify/csv";
import { buildTikTokCsv } from "@/lib/tiktok/csv";

/** GET /api/inventario/export?format=shopify|tiktok&ids=a,b (sin ids: todos los no archivados). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "tiktok" ? "tiktok" : "shopify";
  const ids = (url.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  const products = await prisma.product.findMany({
    where: ids.length ? { id: { in: ids } } : { status: { not: "archived" } },
    include: { images: { orderBy: { position: "asc" } } },
    orderBy: { sku: "asc" },
  });
  // Para Shopify, incluir también las variantes hermanas para no partir un producto.
  const handles = Array.from(new Set(products.map((p) => p.handle)));
  const full = format === "shopify"
    ? await prisma.product.findMany({ where: { handle: { in: handles }, status: { not: "archived" } }, include: { images: { orderBy: { position: "asc" } } }, orderBy: { sku: "asc" } })
    : products;
  const stock = await getStockMap(full.map((p) => p.id));
  const rows: CsvProduct[] = full.map((p) => ({
    handle: p.handle,
    title: p.title,
    descriptionHtml: p.descriptionHtml,
    type: p.type,
    subcategory: p.subcategory,
    extraTags: p.extraTags,
    karat: p.karat,
    grams: Number(p.grams),
    optionName: p.optionName,
    optionValue: p.optionValue,
    sku: p.sku,
    stock: stock.get(p.id) ?? 0,
    priceCents: p.priceCents,
    costCents: p.costCents,
    status: p.status,
    images: p.images.map((i) => i.publicUrl),
  }));
  const csv = format === "shopify" ? buildShopifyCsv(rows) : buildTikTokCsv(rows);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="minivi-${format}-${date}.csv"` },
  });
}
