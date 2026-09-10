"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { parseDollarsToCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { uploadToBucket } from "@/lib/storage";
import { registerIntake, searchProductsForRestock, type IntakeLine } from "@/lib/intake/service";
import { addAttachment, markPayablePaid, unmarkPayablePaid } from "@/lib/purchases/service";
import { intakeFormSchema, payPayableSchema, supplierSchema, type IntakeFormValues } from "./schema";
import type { ProductType } from "@/generated/prisma/client";

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
const PURCHASE_DOCS_BUCKET = "purchase-docs";
const fail = (e: unknown): ActionResult<never> => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

function toInput(v: IntakeFormValues) {
  return {
    supplierId: v.supplierId,
    date: new Date(`${v.date}T00:00:00Z`),
    invoiceNumber: v.invoiceNumber || null,
    costPerGramCents: parseDollarsToCents(v.costPerGram),
    taxCents: parseDollarsToCents(v.tax),
    shippingCents: parseDollarsToCents(v.shipping),
    payments: v.payments.map((p) => ({ amountCents: parseDollarsToCents(p.amount), dueOn: new Date(`${p.dueOn}T00:00:00Z`) })),
    notes: v.notes || null,
    lines: v.lines.map((l): IntakeLine => {
      const common = {
        qty: l.qty,
        premiumCents: parseDollarsToCents(l.premium),
        unitCostCents: l.unitCost != null ? parseDollarsToCents(l.unitCost) : null,
      };
      if (l.mode === "restock") {
        return { ...common, mode: "restock", productId: l.productId as string, updateExisting: l.updateExisting };
      }
      return {
        ...common,
        mode: "new",
        title: (l.title ?? "").trim(),
        type: l.type as ProductType,
        subcategory: l.subcategory,
        extraTags: l.extraTags,
        karat: l.karat,
        grams: Number(l.grams),
        descriptionHtml: l.descriptionHtml,
        optionName: l.optionName || null,
        optionValue: l.optionValue || null,
        priceOverride: l.priceOverride,
        priceCents: l.priceOverride && l.price != null ? parseDollarsToCents(l.price) : null,
        status: l.status,
      };
    }),
  };
}

export async function registerIntakeAction(input: unknown): Promise<ActionResult<{ id: string; number: number; created: number; restocked: number }>> {
  await requireOwner();
  const parsed = intakeFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá los campos.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  try {
    const r = await registerIntake(toInput(parsed.data));
    revalidatePath("/app/inventario");
    revalidatePath("/app/inventario/entradas");
    revalidatePath("/app/inventario/cuentas");
    revalidatePath("/app");
    const partes = [
      r.created.length ? `${r.created.length} pieza${r.created.length === 1 ? "" : "s"} nueva${r.created.length === 1 ? "" : "s"}` : "",
      r.restocked.length ? `${r.restocked.length} reposición${r.restocked.length === 1 ? "" : "es"}` : "",
    ].filter(Boolean);
    return {
      ok: true,
      data: { id: r.purchaseId, number: r.number, created: r.created.length, restocked: r.restocked.length },
      message: `Entrada ${String(r.number).padStart(4, "0")} guardada: ${partes.join(" y ")}`,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function searchProductsAction(q: string): Promise<ActionResult<Awaited<ReturnType<typeof searchProductsForRestock>>>> {
  await requireOwner();
  try {
    return { ok: true, data: await searchProductsForRestock(q) };
  } catch (e) {
    return fail(e);
  }
}

export async function payPayableAction(input: unknown): Promise<ActionResult> {
  await requireOwner();
  const parsed = payPayableSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá los campos." };
  try {
    await markPayablePaid(parsed.data.id, { paidOn: new Date(`${parsed.data.paidOn}T00:00:00Z`), method: parsed.data.method || null, note: parsed.data.note || null });
    revalidatePath("/app/inventario/entradas"); revalidatePath("/app/inventario/cuentas"); revalidatePath("/app");
    return { ok: true, message: "Pago registrado" };
  } catch (e) { return fail(e); }
}

export async function unpayPayableAction(id: string): Promise<ActionResult> {
  await requireOwner();
  try {
    await unmarkPayablePaid(id);
    revalidatePath("/app/inventario/entradas"); revalidatePath("/app/inventario/cuentas"); revalidatePath("/app");
    return { ok: true, message: "Vuelve a pendiente" };
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
    revalidatePath("/app/inventario/proveedores"); revalidatePath("/app/inventario/entradas/nueva");
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
    revalidatePath(`/app/inventario/entradas/${purchaseId}`);
    return { ok: true, message: "Archivo adjuntado" };
  } catch (e) { return fail(e); }
}
