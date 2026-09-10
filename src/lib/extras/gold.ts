import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";

const TROY_OUNCE_GRAMS = 31.1034768;

/**
 * Trae el spot del oro (USD por onza troy). Fuente configurable con GOLD_SPOT_URL;
 * por defecto gold-api.com (gratis, sin clave). El JSON tiene que traer `price`.
 */
export async function fetchSpotUsdPerOunce(): Promise<{ usd: number; source: string }> {
  const url = process.env.GOLD_SPOT_URL ?? "https://api.gold-api.com/price/XAU";
  const res = await fetch(url, { cache: "no-store", headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Spot del oro: ${res.status}`);
  const json = (await res.json()) as Record<string, unknown>;
  const price = Number(json.price ?? json.rate ?? json.usd ?? (json.rates as Record<string, unknown> | undefined)?.XAU);
  if (!Number.isFinite(price) || price <= 0) throw new Error("Spot del oro: respuesta sin precio");
  return { usd: price, source: new URL(url).hostname };
}

export async function recordSpot(usdPerOunce: number, source: string, date = new Date()) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const usdPerOunceCents = Math.round(usdPerOunce * 100);
  const usdPerGramCents = Math.round((usdPerOunce / TROY_OUNCE_GRAMS) * 100);
  const row = await prisma.goldSpot.upsert({ where: { date: day }, create: { date: day, usdPerOunceCents, usdPerGramCents, source }, update: { usdPerOunceCents, usdPerGramCents, source } });
  await audit("gold_spot", day.toISOString().slice(0, 10), null, { usdPerOunceCents, source }, "record");
  return row;
}

export async function refreshSpot() {
  const { usd, source } = await fetchSpotUsdPerOunce();
  return recordSpot(usd, source);
}

/** Valor a metal del inventario vs costo, y aviso sobre el costo por gramo de la próxima compra. */
export async function metalValuation() {
  const s = await getSettings();
  const [spot, history] = await Promise.all([
    prisma.goldSpot.findFirst({ orderBy: { date: "desc" } }),
    prisma.goldSpot.findMany({ orderBy: { date: "desc" }, take: 30 }),
  ]);
  const stock = await prisma.stockMovement.groupBy({ by: ["productId"], _sum: { qty: true } });
  const ids = stock.filter((x) => (x._sum.qty ?? 0) > 0).map((x) => x.productId);
  const products = ids.length ? await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, grams: true, costCents: true, karat: true } }) : [];
  const q = new Map(stock.map((x) => [x.productId, x._sum.qty ?? 0]));
  const purity = (k: string) => (k === "18k" ? 0.75 : k === "10k" ? 0.417 : s.pureza_14k);
  let grams = 0, pureGrams = 0, costCents = 0;
  for (const p of products) { const n = q.get(p.id) ?? 0; grams += Number(p.grams) * n; pureGrams += Number(p.grams) * purity(p.karat) * n; costCents += p.costCents * n; }
  const spotPerGram14k = spot ? Math.round(spot.usdPerGramCents * s.pureza_14k) : null;
  const metalValueCents = spot ? Math.round(pureGrams * spot.usdPerGramCents) : null;
  const deviationPct = spotPerGram14k ? Math.round(((spotPerGram14k - s.costo_por_gramo_default) / s.costo_por_gramo_default) * 100) : null;
  return {
    spot, history, grams: Math.round(grams * 100) / 100, pureGrams: Math.round(pureGrams * 100) / 100, costCents, metalValueCents, spotPerGram14k,
    costPerGramDefault: s.costo_por_gramo_default, deviationPct, alert: deviationPct != null && Math.abs(deviationPct) >= s.spot_alerta_pct,
  };
}
