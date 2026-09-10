import type { ProductType, ProductStatus, StockReason } from "@/generated/prisma/client";

/** Código de SKU por tipo (ver CLAUDE.md). */
export const TYPE_CODES: Record<ProductType, string> = {
  necklace: "NK",
  bracelet: "BR",
  earring: "ER",
  ring: "RG",
  charm: "CH",
  pendant: "PD",
};

export const TYPE_LABELS: Record<ProductType, string> = {
  necklace: "Collar",
  bracelet: "Pulsera",
  earring: "Aro",
  ring: "Anillo",
  charm: "Dije (charm)",
  pendant: "Colgante",
};

export const PRODUCT_TYPES = Object.keys(TYPE_CODES) as ProductType[];

export const STATUS_LABELS: Record<ProductStatus, string> = {
  draft: "Borrador",
  active: "Activo",
  archived: "Archivado",
};

export const REASON_LABELS: Record<StockReason, string> = {
  purchase: "Compra",
  sale: "Venta",
  return: "Devolución",
  adjustment: "Ajuste",
  loss: "Pérdida",
  transfer: "Transferencia",
};

/** Subcategorías válidas (tags de Shopify). */
export const SUBCATEGORIES = [
  "chains", "pendants", "chokers", "layering",
  "bangles", "charm-bracelets", "anklets",
  "hoops", "huggies", "studs", "drops",
  "bands", "stackable", "signet", "statement",
  "initials", "symbols", "faith", "zodiac",
  "kids-earrings", "kids-bracelets", "kids-pendants",
] as const;
export type Subcategory = (typeof SUBCATEGORIES)[number];

/** Subcategorías sugeridas por tipo (la UI las muestra primero; todas siguen siendo válidas). */
export const SUBCATEGORIES_BY_TYPE: Record<ProductType, Subcategory[]> = {
  necklace: ["chains", "pendants", "chokers", "layering", "initials", "symbols", "faith", "zodiac"],
  bracelet: ["bangles", "charm-bracelets", "anklets", "layering", "kids-bracelets"],
  earring: ["hoops", "huggies", "studs", "drops", "kids-earrings"],
  ring: ["bands", "stackable", "signet", "statement"],
  charm: ["symbols", "initials", "faith", "zodiac"],
  pendant: ["pendants", "initials", "symbols", "faith", "zodiac", "kids-pendants"],
};

export const EXTRA_TAGS = ["new", "bestseller", "essential", "gift", "2g", "kids"] as const;
export type ExtraTag = (typeof EXTRA_TAGS)[number];

export const KARATS = ["10k", "14k", "18k"] as const;

export const VENDOR = "MiniVi";
