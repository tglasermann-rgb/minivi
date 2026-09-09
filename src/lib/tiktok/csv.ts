import { toCsv } from "@/lib/csv";
import type { CsvProduct } from "@/lib/shopify/csv";

/**
 * Plantilla de carga masiva de TikTok Shop (simplificada a las columnas que TikTok
 * exige en su template "Basic"; ver docs/TIKTOK.md para mapear al template vigente).
 */
export const TIKTOK_CSV_HEADERS = [
  "Product Name", "Product Description", "Category", "Brand", "Seller SKU",
  "Variation Name", "Variation Value", "Price", "Quantity",
  "Package Weight (g)", "Main Image URL", "Image URL 2", "Image URL 3", "Image URL 4", "Image URL 5",
];

const CATEGORY: Record<string, string> = {
  necklace: "Jewelry Accessories & Derivatives > Fine Jewelry > Necklaces",
  bracelet: "Jewelry Accessories & Derivatives > Fine Jewelry > Bracelets",
  earring: "Jewelry Accessories & Derivatives > Fine Jewelry > Earrings",
  ring: "Jewelry Accessories & Derivatives > Fine Jewelry > Rings",
  charm: "Jewelry Accessories & Derivatives > Fine Jewelry > Charms",
  pendant: "Jewelry Accessories & Derivatives > Fine Jewelry > Pendants",
};

export function buildTikTokCsv(products: CsvProduct[]): string {
  const rows = products.map((p) => [
    p.title,
    p.descriptionHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    CATEGORY[p.type] ?? CATEGORY.necklace,
    "MiniVi",
    p.sku,
    p.optionValue ? (p.optionName ?? "Length") : "",
    p.optionValue ?? "",
    (p.priceCents / 100).toFixed(2),
    Math.max(0, p.stock),
    Math.max(1, Math.ceil(p.grams + 20)), // pieza + empaque
    p.images[0] ?? "",
    p.images[1] ?? "",
    p.images[2] ?? "",
    p.images[3] ?? "",
    p.images[4] ?? "",
  ]);
  return toCsv(TIKTOK_CSV_HEADERS, rows, { bom: true });
}
