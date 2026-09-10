import "server-only";
import { gzipSync } from "node:zlib";
import { prisma } from "@/lib/prisma";
import { signedUrl, uploadToBucket } from "@/lib/storage";
import { audit } from "@/lib/audit";

export const BACKUPS_BUCKET = "backups";

const TABLES = [
  "profile", "setting", "auditLog", "product", "productImage", "stockMovement", "skuCounter", "supplier", "purchase", "purchaseItem", "payable",
  "expenseCategory", "openingBudget", "monthlyBudget", "expense", "employee", "timeEntry", "payPeriod", "payPeriodLine", "customer", "order", "orderItem",
  "webhookEvent", "inventoryCount", "inventoryCountLine", "warrantyClaim", "goldSpot", "cashTarget", "backup",
] as const;

/** Export completo de la base a JSON comprimido en el bucket privado `backups`. */
export async function runBackup(trigger: "cron" | "manual") {
  const dump: Record<string, unknown[]> = {};
  let rows = 0;
  for (const t of TABLES) {
    const model = (prisma as unknown as Record<string, { findMany: (a?: unknown) => Promise<unknown[]> }>)[t];
    const data = t === "webhookEvent" ? await model.findMany({ take: 5000, orderBy: { receivedAt: "desc" } }) : await model.findMany();
    dump[t] = data;
    rows += data.length;
  }
  const json = JSON.stringify({ version: 1, createdAt: new Date().toISOString(), trigger, tables: dump }, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  const gz = gzipSync(Buffer.from(json));
  const path = `minivi-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json.gz`;
  await uploadToBucket(BACKUPS_BUCKET, path, gz, "application/gzip", false);
  const b = await prisma.backup.create({ data: { path, sizeBytes: gz.length, tables: TABLES.length, rows } });
  await audit("backups", b.id, null, { path, sizeBytes: gz.length, rows, trigger }, "backup");
  // Mantener los últimos 12 (3 meses semanales); no se borran filas de historial, solo archivos viejos.
  const old = await prisma.backup.findMany({ orderBy: { createdAt: "desc" }, skip: 12 });
  if (old.length) {
    const { supabaseAdmin } = await import("@/lib/storage");
    await supabaseAdmin().storage.from(BACKUPS_BUCKET).remove(old.map((o) => o.path)).catch(() => null);
    await prisma.backup.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  }
  return b;
}

export async function listBackups() {
  const rows = await prisma.backup.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  return Promise.all(rows.map(async (r) => ({ ...r, url: await signedUrl(BACKUPS_BUCKET, r.path, 600).catch(() => null) })));
}
