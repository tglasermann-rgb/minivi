import type { ProductType } from "@/generated/prisma/client";
import { TYPE_CODES } from "./constants";

const SKU_RE = /^MV-(NK|BR|ER|RG|CH|PD)-(\d{4,})(?:-([A-Za-z0-9.]+))?$/;

/**
 * Sufijo de variante a partir del valor de la opción.
 * "16" → "16" (largo), "6.5" → "6.5" (talla), "16 in" → "16". Sin opción → sin sufijo.
 */
export function variantSuffix(optionValue: string | null | undefined): string | null {
  if (!optionValue) return null;
  const cleaned = optionValue.trim().replace(/\s*(in|inch|inches|"|”|cm|mm)\s*$/i, "").replace(/[^A-Za-z0-9.]/g, "");
  return cleaned ? cleaned.toUpperCase() : null;
}

/** Arma un SKU: MV-NK-0001, MV-NK-0001-16. */
export function formatSku(type: ProductType, number: number, optionValue?: string | null): string {
  if (!Number.isInteger(number) || number < 1) throw new Error(`Número de SKU inválido: ${number}`);
  const base = `MV-${TYPE_CODES[type]}-${String(number).padStart(4, "0")}`;
  const suffix = variantSuffix(optionValue);
  return suffix ? `${base}-${suffix}` : base;
}

export type ParsedSku = { typeCode: string; type: ProductType; number: number; suffix: string | null; base: string };

/** Descompone un SKU válido; lanza si no cumple el formato. */
export function parseSku(sku: string): ParsedSku {
  const m = SKU_RE.exec(sku.trim().toUpperCase());
  if (!m) throw new Error(`SKU inválido: ${sku}`);
  const typeCode = m[1];
  const type = (Object.entries(TYPE_CODES).find(([, code]) => code === typeCode)?.[0] ?? null) as ProductType | null;
  if (!type) throw new Error(`Tipo de SKU desconocido: ${typeCode}`);
  const number = Number(m[2]);
  return { typeCode, type, number, suffix: m[3] ?? null, base: `MV-${typeCode}-${m[2]}` };
}

export function isValidSku(sku: string): boolean {
  return SKU_RE.test(sku.trim().toUpperCase());
}

/** Slug estable para el handle de Shopify. */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "product";
}
