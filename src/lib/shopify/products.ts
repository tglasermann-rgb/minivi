import "server-only";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { getStockMap } from "@/lib/inventory/service";
import { buildTags } from "@/lib/inventory/tags";
import { VENDOR } from "@/lib/inventory/constants";
import { ShopifyError, shopifyGraphql } from "./client";
import type { Product, ProductImage } from "@/generated/prisma/client";

type ProductWithImages = Product & { images: ProductImage[] };

const PRODUCT_SET = /* GraphQL */ `
  mutation ProductSet($input: ProductSetInput!, $synchronous: Boolean!) {
    productSet(input: $input, synchronous: $synchronous) {
      product {
        id
        handle
        variants(first: 100) { nodes { id sku inventoryItem { id } } }
      }
      userErrors { field message }
    }
  }
`;

const INVENTORY_SET = /* GraphQL */ `
  mutation InventorySet($input: InventorySetQuantitiesInput!) {
    inventorySetQuantities(input: $input) {
      inventoryAdjustmentGroup { createdAt }
      userErrors { field message }
    }
  }
`;

function shopifyType(p: Product): string {
  return p.type.charAt(0).toUpperCase() + p.type.slice(1);
}

/**
 * Publica (crea o actualiza) en Shopify el grupo de variantes que comparte `handle`
 * con el producto dado. Devuelve los IDs guardados.
 */
export async function publishHandleToShopify(handle: string): Promise<{ productId: string; variants: number }> {
  const settings = await getSettings();
  const group = await prisma.product.findMany({
    where: { handle, status: { not: "archived" } },
    include: { images: { orderBy: { position: "asc" } } },
    orderBy: { sku: "asc" },
  });
  if (group.length === 0) throw new Error(`No hay productos con handle ${handle}`);
  const main = group[0];
  const stock = await getStockMap(group.map((p) => p.id));
  const hasOptions = group.some((p) => p.optionValue);
  const optionName = main.optionName ?? "Title";
  const existingId = group.find((p) => p.shopifyProductId)?.shopifyProductId ?? null;
  const locationId = settings.shopify_location_id || null;

  const files = dedupe(group.flatMap((p: ProductWithImages) => p.images.map((i) => i.publicUrl))).map((url) => ({
    originalSource: url,
    contentType: "IMAGE",
  }));

  const input: Record<string, unknown> = {
    ...(existingId ? { id: existingId } : {}),
    handle,
    title: main.title,
    descriptionHtml: main.descriptionHtml,
    vendor: VENDOR,
    productType: shopifyType(main),
    tags: buildTags(main.type, main.subcategory, main.extraTags, main.karat),
    status: main.status === "active" ? "ACTIVE" : "DRAFT",
    productOptions: hasOptions
      ? [{ name: optionName, position: 1, values: group.map((p) => ({ name: p.optionValue ?? "Default" })) }]
      : [{ name: "Title", position: 1, values: [{ name: "Default Title" }] }],
    variants: group.map((p) => ({
      ...(p.shopifyVariantId ? { id: p.shopifyVariantId } : {}),
      sku: p.sku,
      barcode: p.barcode,
      price: (p.priceCents / 100).toFixed(2),
      taxable: true,
      optionValues: [{ optionName: hasOptions ? optionName : "Title", name: hasOptions ? p.optionValue ?? "Default" : "Default Title" }],
      inventoryItem: {
        tracked: true,
        cost: (p.costCents / 100).toFixed(2),
        requiresShipping: true,
        measurement: { weight: { unit: "GRAMS", value: Number(p.grams) } },
      },
      ...(locationId ? { inventoryQuantities: [{ locationId, name: "available", quantity: Math.max(0, stock.get(p.id) ?? 0) }] } : {}),
    })),
    ...(files.length ? { files } : {}),
  };

  const data = await shopifyGraphql<{
    productSet: { product: { id: string; variants: { nodes: { id: string; sku: string; inventoryItem: { id: string } }[] } } | null; userErrors: { field: string[]; message: string }[] };
  }>(PRODUCT_SET, { input, synchronous: true });

  if (data.productSet.userErrors.length) {
    throw new ShopifyError(data.productSet.userErrors.map((e) => `${e.field?.join(".") ?? ""}: ${e.message}`).join("; "));
  }
  const product = data.productSet.product;
  if (!product) throw new ShopifyError("Shopify no devolvió el producto");

  const now = new Date();
  for (const p of group) {
    const v = product.variants.nodes.find((n) => n.sku === p.sku);
    const before = { shopifyProductId: p.shopifyProductId, shopifyVariantId: p.shopifyVariantId };
    const after = await prisma.product.update({
      where: { id: p.id },
      data: {
        shopifyProductId: product.id,
        shopifyVariantId: v?.id ?? p.shopifyVariantId,
        shopifyInventoryItemId: v?.inventoryItem.id ?? p.shopifyInventoryItemId,
        shopifySyncedAt: now,
      },
    });
    await audit("products", p.id, before, { shopifyProductId: after.shopifyProductId, shopifyVariantId: after.shopifyVariantId }, "shopify_publish");
  }
  return { productId: product.id, variants: group.length };
}

/** Sincroniza solo el stock de un producto ya publicado. */
export async function pushStockToShopify(productId: string): Promise<void> {
  const settings = await getSettings();
  const p = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  if (!p.shopifyInventoryItemId) throw new Error(`${p.sku} no está publicado en Shopify`);
  if (!settings.shopify_location_id) throw new Error("Falta shopify_location_id en Configuración");
  const stock = (await getStockMap([productId])).get(productId) ?? 0;
  const data = await shopifyGraphql<{ inventorySetQuantities: { userErrors: { message: string }[] } }>(INVENTORY_SET, {
    input: {
      name: "available",
      reason: "correction",
      ignoreCompareQuantity: true,
      quantities: [{ inventoryItemId: p.shopifyInventoryItemId, locationId: settings.shopify_location_id, quantity: Math.max(0, stock) }],
    },
  });
  if (data.inventorySetQuantities.userErrors.length) throw new ShopifyError(data.inventorySetQuantities.userErrors.map((e) => e.message).join("; "));
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
