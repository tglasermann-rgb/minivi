"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { parseDollarsToCents } from "@/lib/money";
import { attachFile, deleteFile, saveDocument, terminateDocument, MAX_FILE_BYTES, type UploadFile } from "@/lib/legal/service";
import { legalSchema } from "./schema";

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };
const fail = (e: unknown): ActionResult<never> => ({ ok: false, error: e instanceof Error ? e.message : String(e) });
const paths = (id?: string) => { revalidatePath("/app/legal"); revalidatePath("/app"); if (id) revalidatePath(`/app/legal/${id}`); };

/** Los archivos vienen en el mismo formulario que los datos, para poder cargar todo de una. */
async function filesFrom(fd: FormData): Promise<UploadFile[]> {
  const out: UploadFile[] = [];
  for (const entry of fd.getAll("files")) {
    if (!(entry instanceof File) || entry.size === 0) continue;
    if (entry.size > MAX_FILE_BYTES) throw new Error(`"${entry.name}" pesa más de 25 MB`);
    out.push({ bytes: Buffer.from(await entry.arrayBuffer()), name: entry.name, contentType: entry.type || "application/octet-stream" });
  }
  return out;
}

function parse(fd: FormData) {
  const obj: Record<string, unknown> = {};
  for (const k of ["title", "category", "status", "counterparty", "reference", "effectiveOn", "expiresOn", "noticeDays", "amount", "notes"]) obj[k] = fd.get(k) ?? "";
  if (obj.noticeDays === "") obj.noticeDays = 30;
  if (obj.amount === "") obj.amount = 0;
  return legalSchema.safeParse(obj);
}

export async function saveDocumentAction(id: string | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  await requireOwner();
  const parsed = parse(fd);
  if (!parsed.success) return { ok: false, error: "Revisá los campos: " + parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(", ") };
  const v = parsed.data;
  try {
    const doc = await saveDocument(id, {
      title: v.title, category: v.category, status: v.status, counterparty: v.counterparty || null, reference: v.reference || null,
      effectiveOn: v.effectiveOn ? new Date(`${v.effectiveOn}T00:00:00Z`) : null,
      expiresOn: v.expiresOn ? new Date(`${v.expiresOn}T00:00:00Z`) : null,
      noticeDays: v.noticeDays, amountCents: parseDollarsToCents(v.amount), notes: v.notes || null,
    }, await filesFrom(fd));
    paths(doc.id);
    return { ok: true, data: { id: doc.id }, message: id ? "Documento guardado" : "Documento creado" };
  } catch (e) { return fail(e); }
}

export async function uploadFilesAction(documentId: string, fd: FormData): Promise<ActionResult> {
  await requireOwner();
  try {
    const files = await filesFrom(fd);
    if (files.length === 0) return { ok: false, error: "Elegí al menos un archivo" };
    for (const f of files) await attachFile(documentId, f);
    paths(documentId);
    return { ok: true, message: `${files.length} archivo(s) subidos` };
  } catch (e) { return fail(e); }
}

export async function deleteFileAction(fileId: string, documentId: string): Promise<ActionResult> {
  await requireOwner();
  try { await deleteFile(fileId); paths(documentId); return { ok: true, message: "Archivo borrado" }; } catch (e) { return fail(e); }
}

export async function terminateDocumentAction(id: string): Promise<ActionResult> {
  await requireOwner();
  try { await terminateDocument(id); paths(id); return { ok: true, message: "Marcado como terminado" }; } catch (e) { return fail(e); }
}
