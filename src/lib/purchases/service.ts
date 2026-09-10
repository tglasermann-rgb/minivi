import "server-only";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

/**
 * Lo que queda del ciclo de una compra después de que llegó: pagos, adjuntos y
 * costo del inventario. Cargar mercadería vive en lib/intake/service.ts, donde
 * la factura y el alta en inventario son un solo acto.
 */
import type { Prisma, PurchaseStatus } from "@/generated/prisma/client";

export async function setPurchaseStatus(id: string, status: PurchaseStatus) {
  const before = await prisma.purchase.findUniqueOrThrow({ where: { id } });
  if (before.status === status) return before;
  const after = await prisma.purchase.update({ where: { id }, data: { status } });
  await audit("purchases", id, { status: before.status }, { status });
  return after;
}

export async function markPayablePaid(id: string, input: { paidOn: Date; method?: string | null; note?: string | null }) {
  const before = await prisma.payable.findUniqueOrThrow({ where: { id } });
  const after = await prisma.payable.update({ where: { id }, data: { paidOn: input.paidOn, method: input.method ?? null, note: input.note ?? null } });
  await audit("payables", id, { paidOn: before.paidOn }, { paidOn: after.paidOn, method: after.method });
  // Cerrar la compra si está recibida y todo pagado
  const p = await prisma.purchase.findUniqueOrThrow({ where: { id: before.purchaseId }, include: { payables: true } });
  if (p.status === "received" && p.payables.every((x) => x.paidOn)) await setPurchaseStatus(p.id, "closed");
  return after;
}

export async function unmarkPayablePaid(id: string) {
  const before = await prisma.payable.findUniqueOrThrow({ where: { id } });
  const after = await prisma.payable.update({ where: { id }, data: { paidOn: null, method: null } });
  await audit("payables", id, { paidOn: before.paidOn }, { paidOn: null });
  const p = await prisma.purchase.findUniqueOrThrow({ where: { id: before.purchaseId } });
  if (p.status === "closed") await setPurchaseStatus(p.id, "received");
  return after;
}

export type AttachmentMeta = { path: string; name: string; size: number; uploadedAt: string };

export async function addAttachment(purchaseId: string, meta: AttachmentMeta) {
  const p = await prisma.purchase.findUniqueOrThrow({ where: { id: purchaseId } });
  const list = (p.attachments as unknown as AttachmentMeta[]) ?? [];
  const next = [...list, meta];
  await prisma.purchase.update({ where: { id: purchaseId }, data: { attachments: next as unknown as Prisma.InputJsonValue } });
  await audit("purchases", purchaseId, null, { attachment: meta.name }, "attach");
}

/** Costo promedio por gramo del inventario actual, ponderado por gramos en stock. */
export async function inventoryAverageCostPerGram(): Promise<{ grams: number; costCents: number; avgCentsPerGram: number; pieces: number }> {
  const stock = await prisma.stockMovement.groupBy({ by: ["productId"], _sum: { qty: true } });
  const ids = stock.filter((s) => (s._sum.qty ?? 0) > 0).map((s) => s.productId);
  if (ids.length === 0) return { grams: 0, costCents: 0, avgCentsPerGram: 0, pieces: 0 };
  const products = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, grams: true, costCents: true } });
  const qtyOf = new Map(stock.map((s) => [s.productId, s._sum.qty ?? 0]));
  let grams = 0, costCents = 0, pieces = 0;
  for (const p of products) {
    const q = qtyOf.get(p.id) ?? 0;
    grams += Number(p.grams) * q;
    costCents += p.costCents * q;
    pieces += q;
  }
  return { grams, costCents, avgCentsPerGram: grams > 0 ? Math.round(costCents / grams) : 0, pieces };
}

/** Cuentas por pagar pendientes que vencen dentro de `days` días (o vencidas). */
export async function upcomingPayables(days = 7) {
  const limit = new Date();
  limit.setDate(limit.getDate() + days);
  return prisma.payable.findMany({
    where: { paidOn: null, dueOn: { lte: limit } },
    include: { purchase: { include: { supplier: true } } },
    orderBy: { dueOn: "asc" },
  });
}
