"use server";
import { getCurrentUser } from "@/lib/auth";
import { clockByPin, type ClockResult } from "@/lib/payroll/service";

export type ClockActionResult = { ok: true; result: ClockResult } | { ok: false; error: string };

export async function clockAction(fd: FormData): Promise<ClockActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "La tablet no tiene sesión. Entrá con el usuario del kiosco." };
  const pin = String(fd.get("pin") ?? "");
  const photo = fd.get("photo");
  let photoData: { bytes: Buffer; contentType: string } | null = null;
  if (photo instanceof Blob && photo.size > 0 && photo.size < 8 * 1024 * 1024) {
    photoData = { bytes: Buffer.from(await photo.arrayBuffer()), contentType: photo.type || "image/jpeg" };
  }
  try {
    const result = await clockByPin(pin, photoData);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}
