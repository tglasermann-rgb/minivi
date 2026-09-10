import { NextResponse } from "next/server";
import { lastSyncAt, syncOrders } from "@/lib/sales/sync";
import { shopifyConfigured } from "@/lib/shopify/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Respaldo diario de los webhooks: trae lo actualizado desde la última sincronización. Vercel Cron lo llama con CRON_SECRET. */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!shopifyConfigured()) return NextResponse.json({ ok: false, reason: "Shopify no configurado" });
  const since = (await lastSyncAt()) ?? null;
  const r = await syncOrders(since ? new Date(since.getTime() - 6 * 3_600_000) : null);
  return NextResponse.json({ ok: true, ...r });
}
