import "server-only";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";
import type { Prisma, ProductType, StockReason } from "@/generated/prisma/client";
import { formatSku, parseSku, slugify } from "./sku";
import { computeCostCents, resolvePriceCents } from "./pricing";
import { assertPublicText, buildTags } from "./tags";

export type ProductInput = {
  title: string;
  type: ProductType;
  subcategory: string;
  extraTags: string[];
  karat: string;
  grams: number;
  descriptionHtml: string;
  optionName?: string | null;
  optionValue?: string | null;
  /** id de un producto existente del que este es variante (comparte número de SKU y handle) */
  variantOfId?: string | null;
  costCents?: number | null;
  costPerGramCents?: number | null;
  priceOverride: boolean;
  priceCents?: number | null;
  status?: "draft" | "active" | "archived";
  notes?: string | null;
  purchaseItemId?: string | null;
  /** stock inicial (crea un movimiento "purchase" o "adjustment") */
  initialQty?: number;
  initialReason?: StockReason;
  initialReference?: string | null;
};

/** Reserva el siguiente número de SKU para un tipo de forma atómica. */
export async function nextSkuNumber(tx: Prisma.TransactionClient, type: ProductType): Promise<number> {
  const rows = await tx.$queryRaw<{ last_number: number }[]>`
    INSERT INTO "sku_counters" ("type", "last_number") VALUES (${type}, 1)
    ON CONFLICT ("type") DO UPDATE SET "last_number" = "sku_counters"."last_number" + 1, "updated_at" = now()
    RETURNING "last_number"`;
  return rows[0].last_number;
}

function validatePublic(input: Pick<ProductInput, "title" | "descriptionHtml">) {
  assertPublicText(input.title, "título");
  assertPublicText(input.descriptionHtml, "descripción");
}

export async function createProduct(input: ProductInput) {
  validatePublic(input);
  const settings = await getSettings();
  const user = await getCurrentUser();
  buildTags(input.type, input.subcategory, input.extraTags, input.karat); // valida

  const costCents =
    input.costCents ?? computeCostCents(input.grams, input.costPerGramCents ?? settings.costo_por_gramo_default);
  const priceCents = resolvePriceCents({
    grams: input.grams,
    priceOverride: input.priceOverride,
    overridePriceCents: input.priceCents,
    pricePerGramCents: settings.precio_por_gramo,
    roundingCents: settings.redondeo_precio,
  });

  const product = await prisma.$transaction(async (tx) => {
    let number: number;
    let handle: string;
    if (input.variantOfId) {
      const base = await tx.product.findUniqueOrThrow({ where: { id: input.variantOfId } });
      if (base.type !== input.type) throw new Error("La variante tiene que ser del mismo tipo que el producto base");
      number = parseSku(base.sku).number;
      handle = base.handle;
    } else {
      number = await nextSkuNumber(tx, input.type);
      handle = `${slugify(input.title)}-${String(number).padStart(4, "0")}`;
    }
    const sku = formatSku(input.type, number, input.optionValue);
    const existing = await tx.product.findUnique({ where: { sku } });
    if (existing) throw new Error(`Ya existe el SKU ${sku}. Si es una variante, cambiá el valor de la opción.`);

    const created = await tx.product.create({
      data: {
        sku,
        handle,
        barcode: sku,
        title: input.title.trim(),
        type: input.type,
        subcategory: input.subcategory,
        extraTags: input.extraTags,
        karat: input.karat,
        grams: input.grams,
        descriptionHtml: input.descriptionHtml,
        optionName: input.optionValue ? input.optionName?.trim() || defaultOptionName(input.type) : null,
        optionValue: input.optionValue?.trim() || null,
        costCents,
        priceCents,
        priceOverride: input.priceOverride,
        status: input.status ?? "draft",
        notes: input.notes ?? null,
        purchaseItemId: input.purchaseItemId ?? null,
        createdBy: user?.id ?? null,
      },
    });

    if (input.initialQty && input.initialQty !== 0) {
      await tx.stockMovement.create({
        data: {
          productId: created.id,
          qty: input.initialQty,
          reason: input.initialReason ?? "adjustment",
          reference: input.initialReference ?? null,
          note: "Stock inicial",
          createdBy: user?.id ?? null,
        },
      });
    }
    return created;
  });

  await audit("products", product.id, null, serialize(product));
  return product;
}

export type ProductUpdate = Partial<Omit<ProductInput, "variantOfId" | "initialQty" | "initialReason" | "initialReference">>;

export async function updateProduct(id: string, input: ProductUpdate) {
  const before = await prisma.product.findUniqueOrThrow({ where: { id } });
  const settings = await getSettings();
  const title = input.title ?? before.title;
  const descriptionHtml = input.descriptionHtml ?? before.descriptionHtml;
  validatePublic({ title, descriptionHtml });

  const type = input.type ?? before.type;
  if (type !== before.type) throw new Error("El tipo no se puede cambiar: el SKU es inmutable.");
  const subcategory = input.subcategory ?? before.subcategory;
  const extraTags = input.extraTags ?? before.extraTags;
  const karat = input.karat ?? before.karat;
  buildTags(type, subcategory, extraTags, karat);

  const grams = input.grams ?? Number(before.grams);
  const priceOverride = input.priceOverride ?? before.priceOverride;
  const priceCents = resolvePriceCents({
    grams,
    priceOverride,
    overridePriceCents: input.priceCents ?? before.priceCents,
    pricePerGramCents: settings.precio_por_gramo,
    roundingCents: settings.redondeo_precio,
  });
  const costCents = resolveCost(input, before, grams);

  const after = await prisma.product.update({
    where: { id },
    data: {
      title: title.trim(),
      subcategory,
      extraTags,
      karat,
      grams,
      descriptionHtml,
      optionName: input.optionName !== undefined ? input.optionName?.trim() || null : before.optionName,
      optionValue: input.optionValue !== undefined ? input.optionValue?.trim() || null : before.optionValue,
      costCents,
      priceCents,
      priceOverride,
      status: input.status ?? before.status,
      notes: input.notes !== undefined ? input.notes : before.notes,
    },
  });
  await audit("products", id, serialize(before), serialize(after));
  return after;
}

/** Recalcula el precio de todos los productos sin override (p. ej. tras cambiar el precio por gramo). */
export async function repriceAll(): Promise<number> {
  const settings = await getSettings();
  const products = await prisma.product.findMany({ where: { priceOverride: false, status: { not: "archived" } } });
  let changed = 0;
  for (const p of products) {
    const priceCents = resolvePriceCents({
      grams: Number(p.grams),
      priceOverride: false,
      pricePerGramCents: settings.precio_por_gramo,
      roundingCents: settings.redondeo_precio,
    });
    if (priceCents !== p.priceCents) {
      const after = await prisma.product.update({ where: { id: p.id }, data: { priceCents } });
      await audit("products", p.id, { priceCents: p.priceCents }, { priceCents: after.priceCents }, "reprice");
      changed++;
    }
  }
  return changed;
}

export async function addStockMovement(input: { productId: string; qty: number; reason: StockReason; reference?: string | null; note?: string | null }) {
  if (!Number.isInteger(input.qty) || input.qty === 0) throw new Error("La cantidad tiene que ser un entero distinto de 0");
  const user = await getCurrentUser();
  const before = await getStock(input.productId);
  const mv = await prisma.stockMovement.create({
    data: {
      productId: input.productId,
      qty: input.qty,
      reason: input.reason,
      reference: input.reference ?? null,
      note: input.note ?? null,
      createdBy: user?.id ?? null,
    },
  });
  await audit("stock_movements", mv.id, { stock: before }, { stock: before + input.qty, qty: input.qty, reason: input.reason, reference: input.reference ?? null });
  return mv;
}

export async function getStock(productId: string): Promise<number> {
  const agg = await prisma.stockMovement.aggregate({ where: { productId }, _sum: { qty: true } });
  return agg._sum.qty ?? 0;
}

/** Stock de muchos productos en una sola consulta. */
export async function getStockMap(productIds: string[]): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const rows = await prisma.stockMovement.groupBy({ by: ["productId"], where: { productId: { in: productIds } }, _sum: { qty: true } });
  return new Map(rows.map((r) => [r.productId, r._sum.qty ?? 0]));
}

/**
 * Costo al editar: manual > costo por gramo dado > si cambiaron los gramos,
 * mantener el costo por gramo anterior > si no, el costo anterior.
 */
function resolveCost(input: ProductUpdate, before: { costCents: number; grams: Prisma.Decimal }, grams: number): number {
  if (input.costCents != null) return input.costCents;
  if (input.costPerGramCents != null) return computeCostCents(grams, input.costPerGramCents);
  const beforeGrams = Number(before.grams);
  if (grams !== beforeGrams && beforeGrams > 0) {
    const perGram = Math.round(before.costCents / beforeGrams);
    return computeCostCents(grams, perGram);
  }
  return before.costCents;
}

function defaultOptionName(type: ProductType): string {
  return type === "ring" ? "Size" : "Length";
}

/** Versión serializable (sin Decimal) para audit_log y para pasar a client components. */
export function serialize<T extends { grams: Prisma.Decimal | number }>(p: T): Omit<T, "grams"> & { grams: number } {
  return { ...p, grams: Number(p.grams) };
}
