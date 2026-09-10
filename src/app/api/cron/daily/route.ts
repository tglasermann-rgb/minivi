import { NextResponse } from "next/server";
import { lastSyncAt, syncOrders } from "@/lib/sales/sync";
import { shopifyConfigured } from "@/lib/shopify/client";
import { refreshSpot } from "@/lib/extras/gold";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Cron diario: respaldo de órdenes de Shopify + spot del oro. */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const out: Record<string, unknown> = {};
  try { const s = await refreshSpot(); out.gold = { usdPerOunce: s.usdPerOunceCents / 100 }; } catch (e) { out.gold = { error: e instanceof Error ? e.message : String(e) }; }
  if (shopifyConfigured()) {
    try { const since = (await lastSyncAt()) ?? null; out.orders = await syncOrders(since ? new Date(since.getTime() - 6 * 3_600_000) : null); } catch (e) { out.orders = { error: e instanceof Error ? e.message : String(e) }; }
  } else out.orders = { skipped: "Shopify no configurado" };
  return NextResponse.json({ ok: true, ...out });
}
