import type { LegalCategory, LegalStatus } from "@/generated/prisma/client";

export const CATEGORY_LABELS: Record<LegalCategory, string> = {
  lease: "Alquiler del local",
  insurance: "Seguros",
  license: "Licencias y permisos",
  supplier: "Proveedores",
  employment: "Empleados",
  company: "Sociedad (LLC)",
  tax: "Impuestos",
  bank: "Banco y financiación",
  other: "Otros",
};

export const CATEGORY_HINTS: Record<LegalCategory, string> = {
  lease: "Contrato del local, adendas, depósito.",
  insurance: "Póliza de joyería, responsabilidad civil, compensación laboral.",
  license: "Licencia de negocio, secondhand dealer, sales tax, permisos del condado.",
  supplier: "Acuerdos con proveedores de oro, consignaciones, NDA.",
  employment: "Ofertas, I-9, W-4, acuerdos de confidencialidad.",
  company: "Articles of Organization, Operating Agreement, EIN, actas.",
  tax: "Declaraciones, resoluciones, avisos del IRS o del estado.",
  bank: "Cuentas, préstamos, líneas de crédito, procesador de pagos.",
  other: "Todo lo demás.",
};

export const STATUS_LABELS: Record<LegalStatus, string> = {
  draft: "Borrador",
  active: "Vigente",
  expired: "Vencido",
  terminated: "Terminado",
};

export type ExpiryState = "sin_vencimiento" | "vigente" | "por_vencer" | "vencido";

/** Días entre hoy y la fecha de vencimiento (negativo si ya venció). */
export function daysUntil(expiresOn: Date | null | undefined, today: Date): number | null {
  if (!expiresOn) return null;
  const a = Date.UTC(expiresOn.getUTCFullYear(), expiresOn.getUTCMonth(), expiresOn.getUTCDate());
  const b = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((a - b) / 86_400_000);
}

/**
 * Estado de vencimiento de un documento. "Por vencer" arranca `noticeDays`
 * antes: es el aviso previo para renovar o cancelar a tiempo.
 */
export function expiryState(doc: { expiresOn: Date | null; noticeDays: number; status: LegalStatus }, today: Date): { state: ExpiryState; days: number | null } {
  if (doc.status === "terminated") return { state: "sin_vencimiento", days: daysUntil(doc.expiresOn, today) };
  const days = daysUntil(doc.expiresOn, today);
  if (days === null) return { state: "sin_vencimiento", days: null };
  if (days < 0) return { state: "vencido", days };
  if (days <= Math.max(0, doc.noticeDays)) return { state: "por_vencer", days };
  return { state: "vigente", days };
}

/** Texto corto para mostrar al lado de la fecha. */
export function expiryLabel(days: number | null): string {
  if (days === null) return "sin vencimiento";
  if (days < 0) return `venció hace ${Math.abs(days)} día${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return "vence hoy";
  return `vence en ${days} día${days === 1 ? "" : "s"}`;
}
