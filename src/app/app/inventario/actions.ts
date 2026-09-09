"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { parseDollarsToCents } from "@/lib/money";
import { addStockMovement, createProduct, repriceAll, updateProduct } from "@/lib/inventory/service";
import { syncPhotosFromDrive } from "@/lib/inventory/photos";
import { publishHandleToShopify, pushStockToShopify } from "@/lib/shopify/products";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { adjustStockSchema, productFormSchema } from "./schema";
import type { ProductType } from "@/generated/prisma/client";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fail(e: unknown): ActionResult<never> {
  const msg = e instanceof Error ? e.message : String(e);
  return { ok: false, error: msg };
}

function toServiceInput(v: z.infer<typeof productFormSchema>) {
  return {
    title: v.title,
    type: v.type as ProductType,
    subcategory: v.subcategory,
    extraTags: v.extraTags,
    karat: v.karat,
    grams: v.grams,
    descriptionHtml: v.descriptionHtml,
    optionName: v.optionName || null,
    optionValue: v.optionValue || null,
    variantOfId: v.variantOfId || null,
    costCents: v.costMode === "total" && v.costTotal != null ? parseDollarsToCents(v.costTotal) : null,
    costPerGramCents: v.costMode === "perGram" && v.costPerGram != null ? parseDollarsToCents(v.costPerGram) : null,
    priceOverride: v.priceOverride,
    priceCents: v.priceOverride && v.price != null ? parseDollarsToCents(v.price) : null,
    status: v.status,
    notes: v.notes || null,
  };
}

export async function createProductAction(input: unknown): Promise<ActionResult<{ id: string; sku: string }>> {
  await requireOwner();
  const parsed = productFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá los campos marcados.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  try {
    const p = await createProduct({ ...toServiceInput(parsed.data), initialQty: parsed.data.initialQty, initialReason: "adjustment" });
    revalidatePath("/app/inventario");
    return { ok: true, data: { id: p.id, sku: p.sku }, message: `Creado ${p.sku}` };
  } catch (e) {
    return fail(e);
  }
}

export async function updateProductAction(id: string, input: unknown): Promise<ActionResult> {
  await requireOwner();
  const parsed = productFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá los campos marcados.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  try {
    const { variantOfId: _ignored, ...rest } = toServiceInput(parsed.data);
    void _ignored;
    await updateProduct(id, rest);
    revalidatePath("/app/inventario");
    revalidatePath(`/app/inventario/${id}`);
    return { ok: true, message: "Producto guardado" };
  } catch (e) {
    return fail(e);
  }
}

export async function adjustStockAction(input: unknown): Promise<ActionResult> {
  await requireOwner();
  const parsed = adjustStockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá los campos.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  try {
    await addStockMovement({ ...parsed.data, reference: parsed.data.reference || null, note: parsed.data.note || null });
    // Si está publicado, empujar el stock nuevo a Shopify (no bloquea si falla).
    let warn = "";
    const p = await prisma.product.findUnique({ where: { id: parsed.data.productId } });
    if (p?.shopifyInventoryItemId) {
      try {
        await pushStockToShopify(p.id);
      } catch (e) {
        warn = ` (no se pudo actualizar Shopify: ${e instanceof Error ? e.message : e})`;
      }
    }
    revalidatePath(`/app/inventario/${parsed.data.productId}`);
    revalidatePath("/app/inventario");
    return { ok: true, message: `Stock ajustado${warn}` };
  } catch (e) {
    return fail(e);
  }
}

export async function setStatusAction(ids: string[], status: "draft" | "active" | "archived"): Promise<ActionResult> {
  await requireOwner();
  try {
    for (const id of ids) {
      const before = await prisma.product.findUniqueOrThrow({ where: { id } });
      if (before.status === status) continue;
      await prisma.product.update({ where: { id }, data: { status } });
      await audit("products", id, { status: before.status }, { status }, status === "archived" ? "archive" : "update");
    }
    revalidatePath("/app/inventario");
    return { ok: true, message: `${ids.length} producto(s) → ${status}` };
  } catch (e) {
    return fail(e);
  }
}

export async function findPhotosAction(ids: string[]): Promise<ActionResult<{ found: number; added: number }>> {
  await requireOwner();
  let found = 0;
  let added = 0;
  const errors: string[] = [];
  for (const id of ids) {
    try {
      const r = await syncPhotosFromDrive(id);
      found += r.found;
      added += r.added;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      if (errors.length >= 3) break;
    }
  }
  revalidatePath("/app/inventario");
  for (const id of ids) revalidatePath(`/app/inventario/${id}`);
  if (errors.length && found === 0) return { ok: false, error: errors[0] };
  return { ok: true, data: { found, added }, message: `${found} foto(s) encontradas, ${added} nueva(s)${errors.length ? `. Errores: ${errors[0]}` : ""}` };
}

export async function publishShopifyAction(ids: string[]): Promise<ActionResult<{ published: number }>> {
  await requireOwner();
  try {
    const products = await prisma.product.findMany({ where: { id: { in: ids } }, select: { handle: true } });
    const handles = Array.from(new Set(products.map((p) => p.handle)));
    let published = 0;
    const errors: string[] = [];
    for (const h of handles) {
      try {
        const r = await publishHandleToShopify(h);
        published += r.variants;
      } catch (e) {
        errors.push(`${h}: ${e instanceof Error ? e.message : e}`);
      }
    }
    revalidatePath("/app/inventario");
    for (const id of ids) revalidatePath(`/app/inventario/${id}`);
    if (published === 0 && errors.length) return { ok: false, error: errors[0] };
    return { ok: true, data: { published }, message: `${published} producto(s) publicados en Shopify${errors.length ? `. Errores: ${errors.join(" | ")}` : ""}` };
  } catch (e) {
    return fail(e);
  }
}

export async function repriceAllAction(): Promise<ActionResult<{ changed: number }>> {
  await requireOwner();
  try {
    const changed = await repriceAll();
    revalidatePath("/app/inventario");
    return { ok: true, data: { changed }, message: `${changed} precio(s) recalculados` };
  } catch (e) {
    return fail(e);
  }
}
