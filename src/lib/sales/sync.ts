import "server-only";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { shopifyGraphql, ShopifyError } from "@/lib/shopify/client";
import type { Prisma } from "@/generated/prisma/client";
import { channelFromSource, toCents } from "./channel";

const ORDER_FIELDS = (withStaff: boolean) => /* GraphQL */ `
  id name createdAt updatedAt cancelledAt sourceName
  displayFinancialStatus displayFulfillmentStatus paymentGatewayNames
  currentSubtotalPriceSet { shopMoney { amount } }
  currentTotalTaxSet { shopMoney { amount } }
  currentTotalDiscountsSet { shopMoney { amount } }
  totalShippingPriceSet { shopMoney { amount } }
  currentTotalPriceSet { shopMoney { amount } }
  totalRefundedSet { shopMoney { amount } }
  ${withStaff ? "staffMember { name }" : ""}
  customer { id displayName email phone numberOfOrders amountSpent { amount } }
  lineItems(first: 100) { nodes { id sku title quantity discountedTotalSet { shopMoney { amount } } originalUnitPriceSet { shopMoney { amount } } } }
  refunds { id createdAt refundLineItems(first: 100) { nodes { quantity lineItem { id } } } }
`;

type Money = { shopMoney: { amount: string } };
export type ShopifyOrder = {
  id: string; name: string; createdAt: string; updatedAt: string; cancelledAt: string | null; sourceName: string | null;
  displayFinancialStatus: string | null; displayFulfillmentStatus: string | null; paymentGatewayNames: string[];
  currentSubtotalPriceSet: Money; currentTotalTaxSet: Money; currentTotalDiscountsSet: Money; totalShippingPriceSet: Money; currentTotalPriceSet: Money; totalRefundedSet: Money;
  staffMember?: { name: string } | null;
  customer: { id: string; displayName: string; email: string | null; phone: string | null; numberOfOrders: string; amountSpent: { amount: string } } | null;
  lineItems: { nodes: { id: string; sku: string | null; title: string; quantity: number; discountedTotalSet: Money; originalUnitPriceSet: Money }[] };
  refunds: { id: string; createdAt: string; refundLineItems: { nodes: { quantity: number; lineItem: { id: string } | null }[] } }[];
};

let staffSupported = true;

async function fetchOrdersPage(query: string, after: string | null): Promise<{ nodes: ShopifyOrder[]; hasNextPage: boolean; endCursor: string | null }> {
  const run = (withStaff: boolean) =>
    shopifyGraphql<{ orders: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: ShopifyOrder[] } }>(
      `query Orders($first: Int!, $after: String, $query: String) { orders(first: $first, after: $after, query: $query, sortKey: UPDATED_AT) { pageInfo { hasNextPage endCursor } nodes { ${ORDER_FIELDS(withStaff)} } } }`,
      { first: 50, after, query },
    );
  try {
    const data = await run(staffSupported);
    return { nodes: data.orders.nodes, ...data.orders.pageInfo };
  } catch (e) {
    if (staffSupported && e instanceof ShopifyError && /staffMember/i.test(e.message)) {
      staffSupported = false;
      const data = await run(false);
      return { nodes: data.orders.nodes, ...data.orders.pageInfo };
    }
    throw e;
  }
}

export async function fetchOrderById(gid: string): Promise<ShopifyOrder | null> {
  const run = (withStaff: boolean) => shopifyGraphql<{ order: ShopifyOrder | null }>(`query Order($id: ID!) { order(id: $id) { ${ORDER_FIELDS(withStaff)} } }`, { id: gid });
  try {
    return (await run(staffSupported)).order;
  } catch (e) {
    if (staffSupported && e instanceof ShopifyError && /staffMember/i.test(e.message)) { staffSupported = false; return (await run(false)).order; }
    throw e;
  }
}

/** Guarda una orden de Shopify (crea o actualiza) y ajusta stock de forma idempotente. */
export async function upsertOrder(o: ShopifyOrder): Promise<{ created: boolean; stockMoves: number }> {
  const refundedByLine = new Map<string, number>();
  for (const r of o.refunds) for (const rl of r.refundLineItems.nodes) if (rl.lineItem) refundedByLine.set(rl.lineItem.id, (refundedByLine.get(rl.lineItem.id) ?? 0) + rl.quantity);

  const skus = o.lineItems.nodes.map((l) => l.sku).filter((s): s is string => !!s);
  const products = skus.length ? await prisma.product.findMany({ where: { sku: { in: skus } } }) : [];
  const bySku = new Map(products.map((p) => [p.sku, p]));

  let customerId: string | null = null;
  if (o.customer) {
    const c = await prisma.customer.upsert({
      where: { shopifyCustomerId: o.customer.id },
      create: { shopifyCustomerId: o.customer.id, name: o.customer.displayName, email: o.customer.email, phone: o.customer.phone, ordersCount: Number(o.customer.numberOfOrders) || 0, totalSpentCents: toCents(o.customer.amountSpent?.amount) },
      update: { name: o.customer.displayName, email: o.customer.email, phone: o.customer.phone, ordersCount: Number(o.customer.numberOfOrders) || 0, totalSpentCents: toCents(o.customer.amountSpent?.amount) },
    });
    customerId = c.id;
  }

  const existing = await prisma.order.findUnique({ where: { shopifyOrderId: o.id }, include: { items: true } });
  const orderData = {
    orderNumber: o.name,
    channel: channelFromSource(o.sourceName),
    sourceName: o.sourceName,
    placedAt: new Date(o.createdAt),
    customerId,
    customerName: o.customer?.displayName ?? null,
    subtotalCents: toCents(o.currentSubtotalPriceSet.shopMoney.amount),
    taxCents: toCents(o.currentTotalTaxSet.shopMoney.amount),
    discountCents: toCents(o.currentTotalDiscountsSet.shopMoney.amount),
    shippingCents: toCents(o.totalShippingPriceSet.shopMoney.amount),
    totalCents: toCents(o.currentTotalPriceSet.shopMoney.amount),
    refundedCents: toCents(o.totalRefundedSet.shopMoney.amount),
    paymentGateway: o.paymentGatewayNames?.[0] ?? null,
    financialStatus: o.displayFinancialStatus,
    fulfillmentStatus: o.displayFulfillmentStatus,
    staffName: o.staffMember?.name ?? null,
    cancelledAt: o.cancelledAt ? new Date(o.cancelledAt) : null,
    raw: o as unknown as Prisma.InputJsonValue,
  };
  const order = existing
    ? await prisma.order.update({ where: { id: existing.id }, data: orderData })
    : await prisma.order.create({ data: { shopifyOrderId: o.id, ...orderData } });

  let stockMoves = 0;
  for (const l of o.lineItems.nodes) {
    const product = l.sku ? bySku.get(l.sku) ?? null : null;
    const refundedQty = refundedByLine.get(l.id) ?? 0;
    const prev = existing?.items.find((i) => i.shopifyLineItemId === l.id) ?? null;
    const unit = toCents(l.originalUnitPriceSet.shopMoney.amount);
    const discounted = toCents(l.discountedTotalSet.shopMoney.amount);
    await prisma.orderItem.upsert({
      where: { orderId_shopifyLineItemId: { orderId: order.id, shopifyLineItemId: l.id } },
      create: {
        orderId: order.id, shopifyLineItemId: l.id, productId: product?.id ?? null, sku: l.sku, title: l.title, qty: l.quantity, refundedQty,
        priceCents: unit, discountCents: Math.max(0, unit * l.quantity - discounted), costCentsAtSale: product?.costCents ?? null, gramsAtSale: product ? product.grams : null,
      },
      update: { qty: l.quantity, refundedQty, sku: l.sku, title: l.title, productId: product?.id ?? prev?.productId ?? null },
    });
    if (!product) continue;
    // Venta: un solo movimiento por línea (idempotente por referencia).
    const saleRef = `order:${o.id}:line:${l.id}`;
    const hasSale = await prisma.stockMovement.findFirst({ where: { reference: saleRef } });
    if (!hasSale && !o.cancelledAt) {
      await prisma.stockMovement.create({ data: { productId: product.id, qty: -l.quantity, reason: "sale", reference: saleRef, note: `Venta ${o.name}` } });
      stockMoves++;
    }
    // Devoluciones: la diferencia entre lo devuelto ya registrado y lo actual.
    const prevRefunded = prev?.refundedQty ?? 0;
    if (refundedQty > prevRefunded) {
      const delta = refundedQty - prevRefunded;
      const ref = `refund:${o.id}:line:${l.id}:${refundedQty}`;
      const has = await prisma.stockMovement.findFirst({ where: { reference: ref } });
      if (!has) {
        await prisma.stockMovement.create({ data: { productId: product.id, qty: delta, reason: "return", reference: ref, note: `Devolución ${o.name}` } });
        stockMoves++;
      }
    }
    // Cancelación después de registrar la venta: reponer stock una sola vez.
    if (o.cancelledAt && hasSale) {
      const ref = `cancel:${o.id}:line:${l.id}`;
      const has = await prisma.stockMovement.findFirst({ where: { reference: ref } });
      if (!has) {
        await prisma.stockMovement.create({ data: { productId: product.id, qty: l.quantity, reason: "return", reference: ref, note: `Cancelación ${o.name}` } });
        stockMoves++;
      }
    }
  }
  if (!existing) await audit("orders", order.id, null, { number: o.name, channel: orderData.channel, totalCents: orderData.totalCents }, "sync");
  return { created: !existing, stockMoves };
}

/** Trae de Shopify las órdenes actualizadas desde `since` (o los últimos 60 días) y las guarda. */
export async function syncOrders(since?: Date | null): Promise<{ fetched: number; created: number; stockMoves: number }> {
  const from = since ?? new Date(Date.now() - 60 * 24 * 3_600_000);
  const query = `updated_at:>='${from.toISOString()}'`;
  let after: string | null = null;
  let fetched = 0, created = 0, stockMoves = 0;
  for (let page = 0; page < 40; page++) {
    const res = await fetchOrdersPage(query, after);
    for (const o of res.nodes) {
      const r = await upsertOrder(o);
      fetched++;
      if (r.created) created++;
      stockMoves += r.stockMoves;
    }
    if (!res.hasNextPage) break;
    after = res.endCursor;
  }
  await prisma.setting.upsert({ where: { key: "shopify_orders_synced_at" }, create: { key: "shopify_orders_synced_at", value: new Date().toISOString() }, update: { value: new Date().toISOString() } });
  return { fetched, created, stockMoves };
}

export async function lastSyncAt(): Promise<Date | null> {
  const s = await prisma.setting.findUnique({ where: { key: "shopify_orders_synced_at" } });
  return s ? new Date(s.value) : null;
}
