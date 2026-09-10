import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchOrderById, upsertOrder } from "@/lib/sales/sync";

export const dynamic = "force-dynamic";

/**
 * Webhooks de Shopify: orders/create, orders/updated, orders/cancelled, refunds/create.
 * Verifica el HMAC con SHOPIFY_WEBHOOK_SECRET, guarda el evento (idempotente por
 * X-Shopify-Webhook-Id) y vuelve a leer la orden por GraphQL para tener un solo mapeo.
 */
export async function POST(request: Request) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "SHOPIFY_WEBHOOK_SECRET no configurado" }, { status: 500 });
  const body = await request.text();
  const hmac = request.headers.get("x-shopify-hmac-sha256") ?? "";
  const digest = createHmac("sha256", secret).update(body, "utf8").digest("base64");
  const a = Buffer.from(digest); const b = Buffer.from(hmac);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "HMAC inválido" }, { status: 401 });

  const webhookId = request.headers.get("x-shopify-webhook-id") ?? `${Date.now()}-${Math.random()}`;
  const topic = request.headers.get("x-shopify-topic") ?? "unknown";
  const shopDomain = request.headers.get("x-shopify-shop-domain");
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(body); } catch { /* cuerpo no JSON */ }

  const existing = await prisma.webhookEvent.findUnique({ where: { webhookId } });
  if (existing?.processedAt) return NextResponse.json({ ok: true, duplicate: true });
  const event = existing ?? (await prisma.webhookEvent.create({ data: { webhookId, topic, shopDomain, payload: payload as never } }));

  try {
    const orderId = topic.startsWith("refunds/") ? payload.order_id : topic.startsWith("orders/") ? payload.id : null;
    if (orderId != null) {
      const gid = String(orderId).startsWith("gid://") ? String(orderId) : `gid://shopify/Order/${orderId}`;
      const order = await fetchOrderById(gid);
      if (order) await upsertOrder(order);
    }
    await prisma.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date(), error: null } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    await prisma.webhookEvent.update({ where: { id: event.id }, data: { error: e instanceof Error ? e.message : String(e) } });
    // 200 igual: Shopify reintenta si devolvemos error, y ya quedó guardado para reprocesar.
    return NextResponse.json({ ok: false, error: "guardado para reintento" });
  }
}
