import "server-only";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { createProduct } from "@/lib/inventory/service";
import { computeCostCents } from "@/lib/inventory/pricing";
import type { Prisma, ProductType, PurchaseStatus } from "@/generated/prisma/client";
import { buildInstallments, purchaseTotals, type Installment, type PaymentTerms } from "./terms";

export type PurchaseLineInput = {
  description: string;
  type: ProductType;
  subcategory: string;
  karat: string;
  grams: number;
  qty: number;
  /** costo unitario manual (centavos); si falta, gramos × costo por gramo de la compra */
  unitCostCents?: number | null;
  optionName?: string | null;
  optionValue?: string | null;
};

export type PurchaseInput = {
  supplierId: string;
  date: Date;
  invoiceNumber?: string | null;
  costPerGramCents: number;
  taxCents: number;
  shippingCents: number;
  paymentTerms: PaymentTerms;
  customInstallments?: Installment[];
  notes?: string | null;
  items: PurchaseLineInput[];
};

function lineCost(costPerGramCents: number, l: PurchaseLineInput) {
  return l.unitCostCents != null && l.unitCostCents >= 0 ? l.unitCostCents : computeCostCents(l.grams, costPerGramCents);
}

export async function createPurchase(input: PurchaseInput) {
  if (input.items.length === 0) throw new Error("La compra necesita al menos una línea");
  const user = await getCurrentUser();
  const lines = input.items.map((l, i) => ({ ...l, position: i + 1, unitCostCents: lineCost(input.costPerGramCents, l), unitCostOverride: l.unitCostCents != null }));
  const { subtotalCents, totalCents } = purchaseTotals(lines, input.taxCents, input.shippingCents);
  const installments = buildInstallments(totalCents, input.paymentTerms, input.date, input.customInstallments);

  const purchase = await prisma.purchase.create({
    data: {
      supplierId: input.supplierId,
      date: input.date,
      invoiceNumber: input.invoiceNumber ?? null,
      costPerGramCents: input.costPerGramCents,
      taxCents: input.taxCents,
      shippingCents: input.shippingCents,
      subtotalCents,
      totalCents,
      paymentTerms: input.paymentTerms,
      notes: input.notes ?? null,
      createdBy: user?.id ?? null,
      items: {
        create: lines.map((l) => ({
          position: l.position,
          description: l.description.trim(),
          type: l.type,
          subcategory: l.subcategory,
          karat: l.karat,
          grams: l.grams,
          qty: l.qty,
          unitCostCents: l.unitCostCents,
          unitCostOverride: l.unitCostOverride,
          optionName: l.optionName || null,
          optionValue: l.optionValue || null,
          createdBy: user?.id ?? null,
        })),
      },
      payables: { create: installments.map((c) => ({ amountCents: c.amountCents, dueOn: c.dueOn, createdBy: user?.id ?? null })) },
    },
  });
  await audit("purchases", purchase.id, null, { number: purchase.number, totalCents, items: lines.length, paymentTerms: input.paymentTerms });
  return purchase;
}

/** Edita cabecera y líneas de una compra en borrador u ordenada sin recepciones. Regenera las cuotas. */
export async function updatePurchase(id: string, input: PurchaseInput) {
  const before = await prisma.purchase.findUniqueOrThrow({ where: { id }, include: { items: true, payables: true } });
  if (before.status === "received" || before.status === "closed") throw new Error("No se puede editar una compra recibida o cerrada");
  if (before.items.some((i) => i.qtyReceived > 0)) throw new Error("Ya hay líneas recibidas: no se puede editar la compra");
  if (before.payables.some((p) => p.paidOn)) throw new Error("Ya hay cuotas pagadas: no se pueden regenerar las cuentas por pagar");
  const user = await getCurrentUser();
  const lines = input.items.map((l, i) => ({ ...l, position: i + 1, unitCostCents: lineCost(input.costPerGramCents, l), unitCostOverride: l.unitCostCents != null }));
  const { subtotalCents, totalCents } = purchaseTotals(lines, input.taxCents, input.shippingCents);
  const installments = buildInstallments(totalCents, input.paymentTerms, input.date, input.customInstallments);

  const after = await prisma.$transaction(async (tx) => {
    await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
    await tx.payable.deleteMany({ where: { purchaseId: id } });
    return tx.purchase.update({
      where: { id },
      data: {
        supplierId: input.supplierId,
        date: input.date,
        invoiceNumber: input.invoiceNumber ?? null,
        costPerGramCents: input.costPerGramCents,
        taxCents: input.taxCents,
        shippingCents: input.shippingCents,
        subtotalCents,
        totalCents,
        paymentTerms: input.paymentTerms,
        notes: input.notes ?? null,
        items: {
          create: lines.map((l) => ({
            position: l.position, description: l.description.trim(), type: l.type, subcategory: l.subcategory, karat: l.karat, grams: l.grams, qty: l.qty,
            unitCostCents: l.unitCostCents, unitCostOverride: l.unitCostOverride, optionName: l.optionName || null, optionValue: l.optionValue || null, createdBy: user?.id ?? null,
          })),
        },
        payables: { create: installments.map((c) => ({ amountCents: c.amountCents, dueOn: c.dueOn, createdBy: user?.id ?? null })) },
      },
    });
  });
  await audit("purchases", id, { totalCents: before.totalCents, items: before.items.length }, { totalCents, items: lines.length });
  return after;
}

export async function setPurchaseStatus(id: string, status: PurchaseStatus) {
  const before = await prisma.purchase.findUniqueOrThrow({ where: { id } });
  if (before.status === status) return before;
  const after = await prisma.purchase.update({ where: { id }, data: { status } });
  await audit("purchases", id, { status: before.status }, { status });
  return after;
}

/**
 * Recibe mercadería: por cada línea con cantidad > 0 crea el producto (si no existe)
 * con SKU y precio automáticos y agrega un movimiento de stock "purchase".
 * Permite recepción parcial. Si todo quedó recibido, la compra pasa a "received".
 */
export async function receivePurchase(id: string, received: { itemId: string; qty: number }[]) {
  const purchase = await prisma.purchase.findUniqueOrThrow({ where: { id }, include: { items: { orderBy: { position: "asc" } } } });
  if (purchase.status === "closed") throw new Error("La compra está cerrada");
  const user = await getCurrentUser();
  const results: { sku: string; qty: number; created: boolean }[] = [];

  for (const r of received) {
    if (!Number.isInteger(r.qty) || r.qty <= 0) continue;
    const item = purchase.items.find((i) => i.id === r.itemId);
    if (!item) throw new Error("Línea inexistente");
    const remaining = item.qty - item.qtyReceived;
    if (r.qty > remaining) throw new Error(`La línea "${item.description}" tiene ${remaining} pendientes y se quisieron recibir ${r.qty}`);

    let productId = item.productId;
    let created = false;
    if (!productId) {
      const product = await createProduct({
        title: item.description,
        type: item.type,
        subcategory: item.subcategory,
        extraTags: ["new"],
        karat: item.karat,
        grams: Number(item.grams),
        descriptionHtml: `<p>Real ${item.karat} gold, stamped ${item.karat}. No plating.</p>`,
        optionName: item.optionName,
        optionValue: item.optionValue,
        costCents: item.unitCostCents,
        priceOverride: false,
        status: "draft",
        purchaseItemId: item.id,
        initialQty: r.qty,
        initialReason: "purchase",
        initialReference: `PO-${purchase.number}`,
      });
      productId = product.id;
      created = true;
      results.push({ sku: product.sku, qty: r.qty, created });
    } else {
      const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
      await prisma.stockMovement.create({ data: { productId, qty: r.qty, reason: "purchase", reference: `PO-${purchase.number}`, note: "Recepción parcial", createdBy: user?.id ?? null } });
      await audit("stock_movements", productId, null, { qty: r.qty, reason: "purchase", reference: `PO-${purchase.number}` });
      results.push({ sku: product.sku, qty: r.qty, created });
    }
    await prisma.purchaseItem.update({ where: { id: item.id }, data: { qtyReceived: item.qtyReceived + r.qty, productId } });
  }

  const fresh = await prisma.purchase.findUniqueOrThrow({ where: { id }, include: { items: true } });
  const allReceived = fresh.items.every((i) => i.qtyReceived >= i.qty);
  const anyReceived = fresh.items.some((i) => i.qtyReceived > 0);
  const nextStatus: PurchaseStatus = allReceived ? "received" : anyReceived && fresh.status === "draft" ? "ordered" : fresh.status;
  if (nextStatus !== fresh.status) await setPurchaseStatus(id, nextStatus);
  await audit("purchases", id, null, { received: results }, "receive");
  return { results, status: nextStatus };
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
