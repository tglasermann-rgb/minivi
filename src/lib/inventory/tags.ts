import type { ProductType } from "@/generated/prisma/client";
import { EXTRA_TAGS, SUBCATEGORIES, type ExtraTag, type Subcategory } from "./constants";

/** Tags de Shopify: tipo + subcategoría + extras + kilataje + real-gold. */
export function buildTags(type: ProductType, subcategory: string, extras: string[], karat: string): string[] {
  if (!(SUBCATEGORIES as readonly string[]).includes(subcategory)) throw new Error(`Subcategoría inválida: ${subcategory}`);
  const bad = extras.filter((e) => !(EXTRA_TAGS as readonly string[]).includes(e));
  if (bad.length) throw new Error(`Extras inválidos: ${bad.join(", ")}`);
  const ordered = EXTRA_TAGS.filter((e) => extras.includes(e));
  return [type, subcategory as Subcategory, ...(ordered as ExtraTag[]), karat, "real-gold"];
}

const FORBIDDEN = [/solid\s+gold/i, /oro\s+s[oó]lido/i];

/** Lanza si un texto público contiene frases prohibidas ("solid gold"). */
export function assertPublicText(text: string, field = "texto"): void {
  for (const re of FORBIDDEN) {
    if (re.test(text)) throw new Error(`El ${field} no puede decir "solid gold". Usá "real 14k gold", "stamped 14k" o "no plating".`);
  }
}

export function hasForbiddenPublicText(text: string): boolean {
  return FORBIDDEN.some((re) => re.test(text));
}
