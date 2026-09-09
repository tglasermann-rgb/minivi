import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPurchaseOrderPdf } from "@/lib/purchases/pdf";

/** GET /api/compras?id=… → PDF de la orden de compra. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const p = await prisma.purchase.findUnique({ where: { id }, include: { supplier: true, items: { orderBy: { position: "asc" } }, payables: { orderBy: { dueOn: "asc" } } } });
  if (!p) return NextResponse.json({ error: "No existe" }, { status: 404 });
  const pdf = await buildPurchaseOrderPdf(p);
  return new NextResponse(Buffer.from(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="PO-${p.number}.pdf"` } });
}
