import { toCsv } from "@/lib/csv";
import { buildTags } from "@/lib/inventory/tags";
import { VENDOR } from "@/lib/inventory/constants";

export type CsvProduct = {
  handle: string;
  title: string;
  descriptionHtml: string;
  type: string;
  subcategory: string;
  extraTags: string[];
  karat: string;
  grams: number;
  optionName: string | null;
  optionValue: string | null;
  sku: string;
  stock: number;
  priceCents: number;
  costCents: number;
  status: "draft" | "active" | "archived";
  images: string[];
};

/** Columnas exactas del importador de productos de Shopify. */
export const SHOPIFY_CSV_HEADERS = [
  "Handle", "Title", "Body (HTML)", "Vendor", "Type", "Tags", "Published",
  "Option1 Name", "Option1 Value", "Variant SKU", "Variant Grams",
  "Variant Inventory Tracker", "Variant Inventory Qty", "Variant Inventory Policy", "Variant Fulfillment Service",
  "Variant Price", "Variant Requires Shipping", "Variant Taxable", "Image Src", "Image Position",
  "Variant Weight Unit", "Cost per item", "Status",
];

/**
 * Genera el CSV de Shopify. Variantes del mismo handle van agrupadas; la primera fila
 * lleva título/descripción/tags; las demás solo los datos de variante.
 * Las imágenes adicionales van en filas extra solo con Handle + Image Src + Image Position.
 */
export function buildShopifyCsv(products: CsvProduct[]): string {
  const byHandle = new Map<string, CsvProduct[]>();
  for (const p of products) {
    if (!byHandle.has(p.handle)) byHandle.set(p.handle, []);
    byHandle.get(p.handle)!.push(p);
  }
  const rows: (string | number | null)[][] = [];
  for (const [handle, group] of byHandle) {
    group.sort((a, b) => a.sku.localeCompare(b.sku));
    const main = group[0];
    const images = Array.from(new Set(group.flatMap((p) => p.images)));
    const hasOptions = group.some((p) => p.optionValue);
    group.forEach((p, i) => {
      const first = i === 0;
      rows.push([
        handle,
        first ? main.title : "",
        first ? main.descriptionHtml : "",
        first ? VENDOR : "",
        first ? cap(main.type) : "",
        first ? buildTags(main.type as never, main.subcategory, main.extraTags, main.karat).join(", ") : "",
        first ? (main.status === "active" ? "TRUE" : "FALSE") : "",
        hasOptions ? (p.optionName ?? "Title") : "Title",
        hasOptions ? (p.optionValue ?? "Default") : "Default Title",
        p.sku,
        p.grams.toFixed(2),
        "shopify",
        p.stock,
        "deny",
        "manual",
        (p.priceCents / 100).toFixed(2),
        "TRUE",
        "TRUE",
        first ? (images[0] ?? "") : "",
        first && images[0] ? 1 : "",
        "g",
        (p.costCents / 100).toFixed(2),
        main.status === "archived" ? "archived" : main.status,
      ]);
    });
    images.slice(1).forEach((src, idx) => {
      const row: (string | number | null)[] = new Array(SHOPIFY_CSV_HEADERS.length).fill("");
      row[0] = handle;
      row[18] = src;
      row[19] = idx + 2;
      rows.push(row);
    });
  }
  return toCsv(SHOPIFY_CSV_HEADERS, rows);
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
