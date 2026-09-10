import "server-only";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { signedUrl, uploadToBucket } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/storage";
import type { LegalCategory, LegalStatus, Prisma } from "@/generated/prisma/client";
import { expiryState, type ExpiryState } from "./expiry";

export const LEGAL_BUCKET = "legal-docs";
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export type LegalInput = {
  title: string;
  category: LegalCategory;
  status: LegalStatus;
  counterparty?: string | null;
  reference?: string | null;
  effectiveOn?: Date | null;
  expiresOn?: Date | null;
  noticeDays: number;
  amountCents: number;
  notes?: string | null;
};

export type UploadFile = { bytes: Buffer; name: string; contentType: string };

export async function saveDocument(id: string | null, input: LegalInput, files: UploadFile[] = []) {
  const user = await getCurrentUser();
  const data = {
    title: input.title.trim(),
    category: input.category,
    status: input.status,
    counterparty: input.counterparty || null,
    reference: input.reference || null,
    effectiveOn: input.effectiveOn ?? null,
    expiresOn: input.expiresOn ?? null,
    noticeDays: Math.max(0, Math.min(365, Math.round(input.noticeDays))),
    amountCents: Math.max(0, input.amountCents),
    notes: input.notes || null,
  };
  const doc = id
    ? await prisma.legalDocument.update({ where: { id }, data })
    : await prisma.legalDocument.create({ data: { ...data, createdBy: user?.id ?? null } });

  for (const f of files) await attachFile(doc.id, f);

  if (id) {
    const before = await prisma.legalDocument.findUniqueOrThrow({ where: { id } });
    await audit("legal_documents", doc.id, { title: before.title, status: before.status, expiresOn: before.expiresOn }, { title: doc.title, status: doc.status, expiresOn: doc.expiresOn });
  } else {
    await audit("legal_documents", doc.id, null, { title: doc.title, category: doc.category, files: files.length });
  }
  return doc;
}

export async function attachFile(documentId: string, f: UploadFile) {
  if (f.bytes.length === 0) return null;
  if (f.bytes.length > MAX_FILE_BYTES) throw new Error(`"${f.name}" pesa más de 25 MB`);
  const user = await getCurrentUser();
  const safe = f.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80) || "documento";
  const path = `${documentId}/${Date.now()}-${safe}`;
  await uploadToBucket(LEGAL_BUCKET, path, f.bytes, f.contentType || "application/octet-stream", false);
  const row = await prisma.legalFile.create({
    data: { documentId, path, name: f.name, contentType: f.contentType || "application/octet-stream", sizeBytes: f.bytes.length, createdBy: user?.id ?? null },
  });
  await audit("legal_files", row.id, null, { documentId, name: f.name, sizeBytes: f.bytes.length }, "attach");
  return row;
}

export async function deleteFile(fileId: string) {
  const file = await prisma.legalFile.findUniqueOrThrow({ where: { id: fileId } });
  await supabaseAdmin().storage.from(LEGAL_BUCKET).remove([file.path]).catch(() => null);
  await prisma.legalFile.delete({ where: { id: fileId } });
  await audit("legal_files", fileId, { name: file.name, documentId: file.documentId }, null, "delete");
}

/** Un documento nunca se borra: se marca terminado para conservar el historial. */
export async function terminateDocument(id: string) {
  const before = await prisma.legalDocument.findUniqueOrThrow({ where: { id } });
  await prisma.legalDocument.update({ where: { id }, data: { status: "terminated" } });
  await audit("legal_documents", id, { status: before.status }, { status: "terminated" }, "terminate");
}

export type LegalFilters = { q?: string; category?: LegalCategory | ""; status?: LegalStatus | ""; expiry?: ExpiryState | "" };

export type LegalRow = {
  id: string; title: string; category: LegalCategory; status: LegalStatus; counterparty: string | null; reference: string | null;
  effectiveOn: Date | null; expiresOn: Date | null; noticeDays: number; amountCents: number; notes: string | null;
  files: number; state: ExpiryState; days: number | null;
};

export async function listDocuments(f: LegalFilters = {}): Promise<{ rows: LegalRow[]; totals: { total: number; porVencer: number; vencidos: number; sinArchivo: number } }> {
  const where: Prisma.LegalDocumentWhereInput = {};
  if (f.q) where.OR = [{ title: { contains: f.q, mode: "insensitive" } }, { counterparty: { contains: f.q, mode: "insensitive" } }, { reference: { contains: f.q, mode: "insensitive" } }, { notes: { contains: f.q, mode: "insensitive" } }];
  if (f.category) where.category = f.category;
  if (f.status) where.status = f.status;

  const docs = await prisma.legalDocument.findMany({ where, include: { _count: { select: { files: true } } }, orderBy: [{ expiresOn: { sort: "asc", nulls: "last" } }, { title: "asc" }], take: 500 });
  const today = new Date();
  let rows: LegalRow[] = docs.map((d) => {
    const { state, days } = expiryState(d, today);
    return {
      id: d.id, title: d.title, category: d.category, status: d.status, counterparty: d.counterparty, reference: d.reference,
      effectiveOn: d.effectiveOn, expiresOn: d.expiresOn, noticeDays: d.noticeDays, amountCents: d.amountCents, notes: d.notes,
      files: d._count.files, state, days,
    };
  });
  if (f.expiry) rows = rows.filter((r) => r.state === f.expiry);
  return {
    rows,
    totals: {
      total: rows.length,
      porVencer: rows.filter((r) => r.state === "por_vencer").length,
      vencidos: rows.filter((r) => r.state === "vencido").length,
      sinArchivo: rows.filter((r) => r.files === 0).length,
    },
  };
}

export async function getDocument(id: string) {
  const d = await prisma.legalDocument.findUnique({ where: { id }, include: { files: { orderBy: { createdAt: "desc" } } } });
  if (!d) return null;
  const files = await Promise.all(d.files.map(async (f) => ({ ...f, url: await signedUrl(LEGAL_BUCKET, f.path, 3600).catch(() => null) })));
  return { ...d, files, ...expiryState(d, new Date()) };
}

/** Documentos por vencer o vencidos, para el aviso en Inicio. */
export async function expiringDocuments(): Promise<LegalRow[]> {
  const { rows } = await listDocuments({ status: "active" });
  return rows.filter((r) => r.state === "por_vencer" || r.state === "vencido").slice(0, 8);
}
