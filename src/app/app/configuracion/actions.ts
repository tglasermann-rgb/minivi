"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireOwner } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { parseDollarsToCents } from "@/lib/money";
import { settingsFormSchema } from "./schema";
import { listLocations, shopifyConfigured } from "@/lib/shopify/client";

export async function listShopifyLocationsAction(): Promise<ActionResult & { locations?: { id: string; name: string }[] }> {
  await requireOwner();
  if (!shopifyConfigured()) return { ok: false, error: "Shopify no está configurado en Vercel (SHOPIFY_STORE_DOMAIN y SHOPIFY_ADMIN_TOKEN). Ver docs/SETUP-SHOPIFY.md." };
  try {
    const locations = (await listLocations()).filter((l) => l.isActive);
    return { ok: true, locations };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type ActionResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function updateSettings(input: unknown): Promise<ActionResult> {
  const user = await requireOwner();

  const parsed = settingsFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Revisá los campos marcados.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const v = parsed.data;

  // Dólares → centavos; el resto como texto.
  const next: Record<string, string> = {
    precio_por_gramo: String(parseDollarsToCents(v.precio_por_gramo)),
    redondeo_precio: String(parseDollarsToCents(v.redondeo_precio)),
    costo_por_gramo_default: String(parseDollarsToCents(v.costo_por_gramo_default)),
    kilataje_default: v.kilataje_default,
    semana_inicia: v.semana_inicia,
    overtime_umbral_horas: String(v.overtime_umbral_horas),
    tienda_timezone: v.tienda_timezone,
    apertura_mes: v.apertura_mes,
    kiosk_foto: v.kiosk_foto,
    drive_root_folder_id: v.drive_root_folder_id,
    shopify_location_id: v.shopify_location_id,
  };

  const current = await getSettings();
  const changed = Object.entries(next).filter(([k, val]) => String(current[k as keyof typeof current]) !== val);
  if (changed.length === 0) return { ok: true };

  await prisma.$transaction(async (tx) => {
    for (const [key, value] of changed) {
      await tx.setting.upsert({
        where: { key },
        create: { key, value, createdBy: user.id },
        update: { value },
      });
    }
  });

  for (const [key, value] of changed) {
    await audit("settings", key, { value: String(current[key as keyof typeof current]) }, { value });
  }

  revalidatePath("/app", "layout");
  return { ok: true };
}
