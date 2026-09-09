"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { parseDollarsToCents } from "@/lib/money";
import { uploadToBucket } from "@/lib/storage";
import { addAttachment, createPurchase, markPayablePaid, receivePurchase, setPurchaseStatus, unmarkPayablePaid, updatePurchase } from "@/lib/purchases/service";
import type { ProductType, PurchaseStatus } from "@/generated/prisma/client";
import { payPayableSchema, purchaseFormSchema, receiveSchema, supplierSchema, type PurchaseFormValues } from "./schema";

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
const fail = (e: unknown): ActionResult<never> => ({ ok: false, error: e instanceof Error ? e.message : String(e) });
const PURCHASE_DOCS_BUCKET = "purchase-docs";

function toInput(v: PurchaseFormValues) {
  return {
    supplierId: v.supplierId,
    date: new Date(`${v.date}T00:00:00Z`),
    invoiceNumber: v.invoiceNumber || null,
    costPerGramCents: parseDollarsToCents(v.costPerGram),
    taxCents: parseDollarsToCents(v.tax),
    shippingCents: parseDollarsToCents(v.shipping),
    paymentTerms: v.paymentTerms,
    customInstallments: v.customInstallments.map((c) => ({ amountCents: parseDollarsToCents(c.amount), dueOn: new Date(`${c.dueOn}T00:00:00Z`) })),
    notes: v.notes || null,
    items: v.items.map((l) => ({
      description: l.description,
      type: l.type as ProductType,
      subcategory: l.subcategory,
      karat: l.karat,
      grams: l.grams,
      qty: l.qty,
      unitCostCents: l.unitCost != null ? parseDollarsToCents(l.unitCost) : null,
      optionName: l.optionName || null,
      optionValue: l.optionValue || null,
    })),
  };
}

export async function createPurchaseAction(input: unknown): Promise<ActionResult<{ id: string; number: number }>> {
  await requireOwner();
  const parsed = purchaseFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá los campos.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  try {
    const p = await createPurchase(toInput(parsed.data));
    revalidatePath("/app/compras");
    return { ok: true, data: { id: p.id, number: p.number }, message: `Compra PO-${p.number} creada` };
  } catch (e) { return fail(e); }
}

export async function updatePurchaseAction(id: string, input: unknown): Promise<ActionResult> {
  await requireOwner();
  const parsed = purchaseFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá los campos.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  try {
    await updatePurchase(id, toInput(parsed.data));
    revalidatePath("/app/compras"); revalidatePath(`/app/compras/${id}`);
    return { ok: true, message: "Compra guardada" };
  } catch (e) { return fail(e); }
}

export async function setPurchaseStatusAction(id: string, status: PurchaseStatus): Promise<ActionResult> {
  await requireOwner();
  try {
    await setPurchaseStatus(id, status);
    revalidatePath("/app/compras"); revalidatePath(`/app/compras/${id}`);
    return { ok: true, message: `Estado: ${status}` };
  } catch (e) { return fail(e); }
}

export async function receivePurchaseAction(input: unknown): Promise<ActionResult<{ results: { sku: string; qty: number; created: boolean }[] }>> {
  await requireOwner();
  const parsed = receiveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá las cantidades." };
  try {
    const r = await receivePurchase(parsed.data.purchaseId, parsed.data.lines.filter((l) => l.qty > 0));
    revalidatePath("/app/compras"); revalidatePath(`/app/compras/${parsed.data.purchaseId}`); revalidatePath("/app/inventario");
    const created = r.results.filter((x) => x.created).length;
    const units = r.results.reduce((s, x) => s + x.qty, 0);
    return { ok: true, data: { results: r.results }, message: `${units} unidad(es) recibidas, ${created} producto(s) nuevos` };
  } catch (e) { return fail(e); }
}

export async function payPayableAction(input: unknown): Promise<ActionResult> {
  await requireOwner();
  const parsed = payPayableSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá los campos." };
  try {
    await markPayablePaid(parsed.data.id, { paidOn: new Date(`${parsed.data.paidOn}T00:00:00Z`), method: parsed.data.method || null, note: parsed.data.note || null });
    revalidatePath("/app/compras"); revalidatePath("/app/compras/cuentas"); revalidatePath("/app");
    return { ok: true, message: "Cuota marcada como pagada" };
  } catch (e) { return fail(e); }
}

export async function unpayPayableAction(id: string): Promise<ActionResult> {
  await requireOwner();
  try {
    await unmarkPayablePaid(id);
    revalidatePath("/app/compras"); revalidatePath("/app/compras/cuentas"); revalidatePath("/app");
    return { ok: true, message: "Cuota vuelve a pendiente" };
  } catch (e) { return fail(e); }
}

export async function saveSupplierAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireOwner();
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá los campos.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  const v = parsed.data;
  try {
    const data = { name: v.name, contact: v.contact || null, paymentTerms: v.paymentTerms || null, notes: v.notes || null, active: v.active };
    let out;
    if (id) {
      const before = await prisma.supplier.findUniqueOrThrow({ where: { id } });
      out = await prisma.supplier.update({ where: { id }, data });
      await audit("suppliers", id, { name: before.name, active: before.active }, { name: out.name, active: out.active });
    } else {
      out = await prisma.supplier.create({ data: { ...data, createdBy: user.id } });
      await audit("suppliers", out.id, null, { name: out.name });
    }
    revalidatePath("/app/compras/proveedores"); revalidatePath("/app/compras/nueva");
    return { ok: true, data: { id: out.id }, message: "Proveedor guardado" };
  } catch (e) { return fail(e); }
}

export async function uploadPurchaseDocAction(formData: FormData): Promise<ActionResult> {
  await requireOwner();
  const purchaseId = String(formData.get("purchaseId") ?? "");
  const file = formData.get("file");
  if (!purchaseId || !(file instanceof File) || file.size === 0) return { ok: false, error: "Elegí un archivo" };
  if (file.size > 15 * 1024 * 1024) return { ok: false, error: "Máximo 15 MB" };
  try {
    const safe = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
    const path = `${purchaseId}/${Date.now()}-${safe}`;
    await uploadToBucket(PURCHASE_DOCS_BUCKET, path, Buffer.from(await file.arrayBuffer()), file.type || "application/octet-stream", false);
    await addAttachment(purchaseId, { path, name: file.name, size: file.size, uploadedAt: new Date().toISOString() });
    revalidatePath(`/app/compras/${purchaseId}`);
    return { ok: true, message: "Archivo adjuntado" };
  } catch (e) { return fail(e); }
}
