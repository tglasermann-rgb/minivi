"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { applyAdjustments, closeCount, createCount, scanSku, setCounted } from "@/lib/extras/counts";

type R<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };
const fail = (e: unknown): R<never> => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

export async function createCountAction(note: string): Promise<R<{ id: string }>> {
  await requireOwner();
  try { const c = await createCount(note || null); revalidatePath("/app/inventario/conteo"); return { ok: true, data: { id: c.id } }; } catch (e) { return fail(e); }
}
export async function scanAction(countId: string, sku: string, qty = 1): Promise<R<{ sku: string; title: string; counted: number }>> {
  await requireOwner();
  try { const r = await scanSku(countId, sku, qty); return { ok: true, data: { sku: r.product.sku, title: r.product.title, counted: r.counted } }; } catch (e) { return fail(e); }
}
export async function setCountedAction(countId: string, productId: string, counted: number): Promise<R> {
  await requireOwner();
  try { await setCounted(countId, productId, Math.max(0, Math.floor(counted))); revalidatePath(`/app/inventario/conteo/${countId}`); return { ok: true }; } catch (e) { return fail(e); }
}
export async function closeCountAction(countId: string): Promise<R> {
  await requireOwner();
  try { await closeCount(countId); revalidatePath(`/app/inventario/conteo/${countId}`); return { ok: true, message: "Conteo cerrado" }; } catch (e) { return fail(e); }
}
export async function applyAdjustmentsAction(countId: string): Promise<R<{ applied: number }>> {
  await requireOwner();
  try { const n = await applyAdjustments(countId); revalidatePath(`/app/inventario/conteo/${countId}`); revalidatePath("/app/inventario"); return { ok: true, data: { applied: n }, message: `${n} ajuste(s) aplicados al stock` }; } catch (e) { return fail(e); }
}
