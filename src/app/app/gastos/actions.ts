"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { parseDollarsToCents } from "@/lib/money";
import { createExpense, markReimbursed, setCategoryMonthlyBudget, setMonthOverride, setOpeningBudget, updateExpense } from "@/lib/expenses/service";
import { expenseSchema } from "./schema";

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
const fail = (e: unknown): ActionResult<never> => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

function parseForm(fd: FormData) {
  const obj: Record<string, unknown> = {};
  for (const k of ["date", "categoryId", "vendor", "amount", "paymentMethod", "frequency", "notes"]) obj[k] = fd.get(k) ?? "";
  obj.recurring = fd.get("recurring") === "on" || fd.get("recurring") === "true";
  obj.paid = fd.get("paid") !== "off" && fd.get("paid") !== "false";
  obj.reimbursable = fd.get("reimbursable") === "on" || fd.get("reimbursable") === "true";
  return expenseSchema.safeParse(obj);
}

async function receiptFrom(fd: FormData) {
  const f = fd.get("receipt");
  if (!(f instanceof File) || f.size === 0) return null;
  if (f.size > 15 * 1024 * 1024) throw new Error("La foto pesa más de 15 MB");
  return { bytes: Buffer.from(await f.arrayBuffer()), contentType: f.type || "image/jpeg", name: f.name || "recibo.jpg" };
}

export async function createExpenseAction(fd: FormData): Promise<ActionResult<{ id: string }>> {
  await requireOwner();
  const parsed = parseForm(fd);
  if (!parsed.success) return { ok: false, error: "Revisá los campos.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  try {
    const v = parsed.data;
    const e = await createExpense({
      date: new Date(`${v.date}T00:00:00Z`), categoryId: v.categoryId, vendor: v.vendor, amountCents: parseDollarsToCents(v.amount), paymentMethod: v.paymentMethod,
      recurring: v.recurring, frequency: v.frequency, notes: v.notes || null, paid: v.paid, reimbursable: v.reimbursable, receipt: await receiptFrom(fd),
    });
    revalidatePath("/app/gastos"); revalidatePath("/app");
    return { ok: true, data: { id: e.id }, message: "Gasto cargado" };
  } catch (e) { return fail(e); }
}

export async function updateExpenseAction(id: string, fd: FormData): Promise<ActionResult> {
  await requireOwner();
  const parsed = parseForm(fd);
  if (!parsed.success) return { ok: false, error: "Revisá los campos.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  try {
    const v = parsed.data;
    await updateExpense(id, {
      date: new Date(`${v.date}T00:00:00Z`), categoryId: v.categoryId, vendor: v.vendor, amountCents: parseDollarsToCents(v.amount), paymentMethod: v.paymentMethod,
      recurring: v.recurring, frequency: v.frequency, notes: v.notes || null, paid: v.paid, reimbursable: v.reimbursable, receipt: await receiptFrom(fd),
    });
    revalidatePath("/app/gastos");
    return { ok: true, message: "Gasto guardado" };
  } catch (e) { return fail(e); }
}

export async function reimburseAction(id: string, on: string | null): Promise<ActionResult> {
  await requireOwner();
  try {
    await markReimbursed(id, on ? new Date(`${on}T00:00:00Z`) : null);
    revalidatePath("/app/gastos");
    return { ok: true, message: on ? "Marcado como reembolsado" : "Reembolso deshecho" };
  } catch (e) { return fail(e); }
}

export async function setOpeningBudgetAction(group: string, amount: number): Promise<ActionResult> {
  await requireOwner();
  try { await setOpeningBudget(group, parseDollarsToCents(amount)); revalidatePath("/app/gastos/apertura"); revalidatePath("/app/gastos/presupuestos"); return { ok: true, message: "Presupuesto guardado" }; } catch (e) { return fail(e); }
}

export async function setCategoryBudgetAction(categoryId: string, monthly: number, later: number | null): Promise<ActionResult> {
  await requireOwner();
  try { await setCategoryMonthlyBudget(categoryId, parseDollarsToCents(monthly), later != null ? parseDollarsToCents(later) : null); revalidatePath("/app/gastos/mensual"); revalidatePath("/app/gastos/presupuestos"); return { ok: true, message: "Presupuesto guardado" }; } catch (e) { return fail(e); }
}

export async function setMonthOverrideAction(categoryId: string, yearMonth: string, amount: number | null): Promise<ActionResult> {
  await requireOwner();
  try { await setMonthOverride(categoryId, yearMonth, amount != null ? parseDollarsToCents(amount) : null); revalidatePath("/app/gastos/mensual"); return { ok: true, message: "Mes actualizado" }; } catch (e) { return fail(e); }
}
