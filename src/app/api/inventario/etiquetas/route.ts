import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildLabelsPdf } from "@/lib/labels";

/** GET /api/inventario/etiquetas?ids=a,b,c&copies=1 → PDF de etiquetas (una por página). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const copies = Math.min(50, Math.max(1, Number(url.searchParams.get("copies") ?? 1) || 1));
  if (ids.length === 0) return NextResponse.json({ error: "Faltan ids" }, { status: 400 });

  const products = await prisma.product.findMany({ where: { id: { in: ids } }, orderBy: { sku: "asc" } });
  const pdf = await buildLabelsPdf(
    products.map((p) => ({ sku: p.sku, priceCents: p.priceCents, grams: Number(p.grams), karat: p.karat })),
    { copies },
  );
  const name = products.length === 1 ? `etiqueta-${products[0].sku}.pdf` : `etiquetas-${products.length}.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${name}"` },
  });
}
