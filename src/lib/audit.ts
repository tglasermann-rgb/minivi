import "server-only";
import { prisma } from "./prisma";
import { getCurrentUser } from "./auth";
import type { Prisma } from "@/generated/prisma/client";

type Json = Prisma.InputJsonValue;

/**
 * Registra un cambio en `audit_log`. Llamar desde toda server action que
 * modifique datos (stock, precio, costo, settings, etc.).
 *
 * @param entity   nombre de la tabla/entidad, p. ej. "settings", "products"
 * @param id       id de la fila afectada
 * @param before   estado anterior (null si es creación)
 * @param after    estado nuevo (null si es archivado/borrado lógico)
 * @param action   "create" | "update" | "archive" | texto libre
 */
export async function audit(
  entity: string,
  id: string | number | bigint,
  before: Json | null,
  after: Json | null,
  action: string = before === null ? "create" : after === null ? "archive" : "update",
) {
  const user = await getCurrentUser();
  await prisma.auditLog.create({
    data: {
      entity,
      entityId: String(id),
      action,
      before: before ?? undefined,
      after: after ?? undefined,
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
      createdBy: user?.id ?? null,
    },
  });
}
