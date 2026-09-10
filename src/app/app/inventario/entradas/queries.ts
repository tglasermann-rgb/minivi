import "server-only";
import { prisma } from "@/lib/prisma";
import { signedUrl } from "@/lib/storage";
import type { AttachmentMeta } from "@/lib/purchases/service";

export async function listPurchases() {
  const rows = await prisma.purchase.findMany({
    include: { supplier: true, items: { select: { qty: true, qtyReceived: true } }, payables: { select: { amountCents: true, paidOn: true } } },
    orderBy: { number: "desc" },
    take: 300,
  });
  return rows.map((p) => ({
    id: p.id,
    number: p.number,
    date: p.date,
    supplier: p.supplier.name,
    status: p.status,
    totalCents: p.totalCents,
    units: p.items.reduce((s, i) => s + i.qty, 0),
    unitsReceived: p.items.reduce((s, i) => s + i.qtyReceived, 0),
    pendingCents: p.payables.filter((x) => !x.paidOn).reduce((s, x) => s + x.amountCents, 0),
  }));
}

export async function getPurchase(id: string) {
  const p = await prisma.purchase.findUnique({
    where: { id },
    include: { supplier: true, items: { orderBy: { position: "asc" } }, payables: { orderBy: { dueOn: "asc" } } },
  });
  if (!p) return null;
  const productIds = p.items.map((i) => i.productId).filter((x): x is string => !!x);
  const products = productIds.length ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, sku: true } }) : [];
  const skuOf = new Map(products.map((x) => [x.id, x.sku]));
  const attachments = await Promise.all(
    ((p.attachments as unknown as AttachmentMeta[]) ?? []).map(async (a) => ({ ...a, url: await signedUrl("purchase-docs", a.path).catch(() => null) })),
  );
  return {
    ...p,
    items: p.items.map((i) => ({ ...i, grams: Number(i.grams), sku: i.productId ? skuOf.get(i.productId) ?? null : null })),
    attachments,
  };
}

export async function listSuppliers(onlyActive = false) {
  return prisma.supplier.findMany({ where: onlyActive ? { active: true } : {}, orderBy: { name: "asc" } });
}

export async function listPayables(filter: "pending" | "paid" | "all") {
  const rows = await prisma.payable.findMany({
    where: filter === "pending" ? { paidOn: null } : filter === "paid" ? { paidOn: { not: null } } : {},
    include: { purchase: { include: { supplier: true } } },
    orderBy: [{ dueOn: "asc" }],
    take: 500,
  });
  const pendingCents = rows.filter((r) => !r.paidOn).reduce((s, r) => s + r.amountCents, 0);
  return { rows, pendingCents };
}
