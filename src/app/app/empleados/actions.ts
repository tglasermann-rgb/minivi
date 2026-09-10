"use server";
import { revalidatePath } from "next/cache";
import { TZDate } from "@date-fns/tz";
import { requireOwner } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { parseDollarsToCents } from "@/lib/money";
import { closePeriod, deleteEntry, markPeriodPaid, reopenPeriod, saveEmployee, upsertEntry } from "@/lib/payroll/service";
import { employeeSchema, entrySchema } from "./schema";

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
const fail = (e: unknown): ActionResult<never> => ({ ok: false, error: e instanceof Error ? e.message : String(e) });
const paths = () => { revalidatePath("/app/empleados"); revalidatePath("/app/empleados/nomina"); revalidatePath("/app"); };

export async function saveEmployeeAction(id: string | null, input: unknown): Promise<ActionResult> {
  await requireOwner();
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá los campos.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  const v = parsed.data;
  try {
    await saveEmployee(id, { name: v.name, pin: v.pin || null, hourlyRateCents: parseDollarsToCents(v.hourlyRate), hiredOn: v.hiredOn ? new Date(`${v.hiredOn}T00:00:00Z`) : null, active: v.active, phone: v.phone || null, email: v.email || null, notes: v.notes || null, shopifyStaffName: v.shopifyStaffName || null });
    paths();
    return { ok: true, message: "Empleada guardada" };
  } catch (e) { return fail(e); }
}

/** Convierte fecha + hora local de la tienda a instante UTC. */
async function localToDate(date: string, time: string): Promise<Date> {
  const s = await getSettings();
  const [h, m] = time.split(":").map(Number);
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(new TZDate(y, mo - 1, d, h, m, 0, s.tienda_timezone).getTime());
}

export async function saveEntryAction(id: string | null, input: unknown): Promise<ActionResult> {
  await requireOwner();
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá los campos.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  const v = parsed.data;
  try {
    const clockIn = await localToDate(v.date, v.timeIn);
    let clockOut: Date | null = null;
    if (v.timeOut) {
      clockOut = await localToDate(v.date, v.timeOut);
      if (clockOut <= clockIn) clockOut = new Date(clockOut.getTime() + 24 * 3_600_000); // cruza medianoche
    }
    await upsertEntry(id, { employeeId: v.employeeId, clockIn, clockOut, breakMinutes: v.breakMinutes, note: v.note || null });
    paths();
    return { ok: true, message: "Entrada guardada" };
  } catch (e) { return fail(e); }
}

export async function deleteEntryAction(id: string): Promise<ActionResult> {
  await requireOwner();
  try { await deleteEntry(id); paths(); return { ok: true, message: "Entrada borrada" }; } catch (e) { return fail(e); }
}

export async function closePeriodAction(start: string, end: string): Promise<ActionResult<{ id: string }>> {
  await requireOwner();
  try { const p = await closePeriod({ start, end }); paths(); return { ok: true, data: { id: p.id }, message: "Período cerrado" }; } catch (e) { return fail(e); }
}

export async function reopenPeriodAction(id: string): Promise<ActionResult> {
  await requireOwner();
  try { await reopenPeriod(id); paths(); return { ok: true, message: "Período reabierto" }; } catch (e) { return fail(e); }
}

export async function markPaidAction(id: string): Promise<ActionResult> {
  await requireOwner();
  try { await markPeriodPaid(id); paths(); return { ok: true, message: "Período marcado como pagado" }; } catch (e) { return fail(e); }
}
