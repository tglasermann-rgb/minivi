"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { parseDollarsToCents } from "@/lib/money";
import { setCashTarget } from "@/lib/reports/service";

export async function setCashTargetAction(monthIndex: number, dollars: number): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  await requireOwner();
  try {
    if (!Number.isInteger(monthIndex) || monthIndex < 1 || monthIndex > 12) throw new Error("Mes inválido");
    await setCashTarget(monthIndex, parseDollarsToCents(dollars));
    revalidatePath("/app/reportes"); revalidatePath("/app");
    return { ok: true, message: `Objetivo del mes ${monthIndex} guardado` };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}
