"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { shopifyConfigured } from "@/lib/shopify/client";
import { fetchOrderById, lastSyncAt, syncOrders, upsertOrder } from "@/lib/sales/sync";

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

export async function syncOrdersAction(full = false): Promise<ActionResult<{ fetched: number; created: number }>> {
  await requireOwner();
  if (!shopifyConfigured()) return { ok: false, error: "Shopify no está configurado en Vercel (SHOPIFY_STORE_DOMAIN y SHOPIFY_ADMIN_TOKEN). Ver docs/SETUP-SHOPIFY.md." };
  try {
    const since = full ? new Date("2020-01-01") : (await lastSyncAt()) ?? null;
    const r = await syncOrders(since ? new Date(since.getTime() - 3_600_000) : null);
    revalidatePath("/app/ventas"); revalidatePath("/app"); revalidatePath("/app/inventario");
    return { ok: true, data: { fetched: r.fetched, created: r.created }, message: `${r.fetched} orden(es) revisadas, ${r.created} nuevas, ${r.stockMoves} movimiento(s) de stock` };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

/** Reprocesa los webhooks que quedaron con error. */
export async function retryWebhooksAction(): Promise<ActionResult<{ retried: number; ok: number }>> {
  await requireOwner();
  const failed = await prisma.webhookEvent.findMany({ where: { processedAt: null }, orderBy: { receivedAt: "asc" }, take: 50 });
  let ok = 0;
  for (const ev of failed) {
    try {
      const payload = ev.payload as { id?: number | string; order_id?: number | string };
      const orderId = ev.topic.startsWith("refunds/") ? payload.order_id : payload.id;
      if (orderId != null) {
        const order = await fetchOrderById(String(orderId).startsWith("gid://") ? String(orderId) : `gid://shopify/Order/${orderId}`);
        if (order) await upsertOrder(order);
      }
      await prisma.webhookEvent.update({ where: { id: ev.id }, data: { processedAt: new Date(), error: null } });
      ok++;
    } catch (e) {
      await prisma.webhookEvent.update({ where: { id: ev.id }, data: { error: e instanceof Error ? e.message : String(e) } });
    }
  }
  revalidatePath("/app/ventas");
  return { ok: true, data: { retried: failed.length, ok }, message: `${ok}/${failed.length} webhook(s) reprocesados` };
}
