import type { SalesChannel } from "@/generated/prisma/client";

/** Canal a partir de `source_name` de Shopify: web, pos, tiktok u other. */
export function channelFromSource(sourceName: string | null | undefined): SalesChannel {
  const s = (sourceName ?? "").toLowerCase();
  if (!s) return "other";
  if (s === "web" || s === "shopify_draft_order" || s.includes("online") || s === "checkout") return "web";
  if (/\bpos\b/.test(s) || s.includes("point of sale") || s.includes("shopify_pos")) return "pos";
  if (s.includes("tiktok")) return "tiktok";
  return "other";
}

export const CHANNEL_LABELS: Record<SalesChannel, string> = { web: "Web", pos: "Tienda (POS)", tiktok: "TikTok Shop", other: "Otro" };

export function toCents(amount: string | number | null | undefined): number {
  if (amount == null || amount === "") return 0;
  const n = typeof amount === "number" ? amount : Number(amount);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
