import { PageHeader } from "@/components/layout/page-header";
import { getSettings } from "@/lib/settings";
import { centsToDollarsString } from "@/lib/money";
import { SettingsForm } from "./settings-form";
import { AuditRecent } from "./audit-recent";
import type { SettingsFormValues } from "./schema";

export const metadata = { title: "Configuración" };
export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const s = await getSettings();
  const defaults: SettingsFormValues = {
    precio_por_gramo: Number(centsToDollarsString(s.precio_por_gramo)),
    redondeo_precio: Number(centsToDollarsString(s.redondeo_precio)),
    costo_por_gramo_default: Number(centsToDollarsString(s.costo_por_gramo_default)),
    kilataje_default: (["10k", "14k", "18k"].includes(s.kilataje_default) ? s.kilataje_default : "14k") as SettingsFormValues["kilataje_default"],
    semana_inicia: (s.semana_inicia === "sunday" ? "sunday" : "monday"),
    overtime_umbral_horas: s.overtime_umbral_horas,
    tienda_timezone: s.tienda_timezone,
    drive_root_folder_id: s.drive_root_folder_id,
    shopify_location_id: s.shopify_location_id,
  };

  return (
    <>
      <PageHeader eyebrow="Configuración" title="Parámetros del negocio" description="Todo cambio queda registrado en el historial." />
      <SettingsForm defaultValues={defaults} />
      <AuditRecent entity="settings" />
    </>
  );
}
