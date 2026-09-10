import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, FileTextIcon, ImageIcon, PaperclipIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { CATEGORY_LABELS, STATUS_LABELS, expiryLabel } from "@/lib/legal/expiry";
import { getDocument } from "@/lib/legal/service";
import { DocumentForm } from "../document-form";
import { FileUpload, DeleteFileButton, TerminateButton } from "./file-actions";

export const dynamic = "force-dynamic";
const dateFmt = new Intl.DateTimeFormat("es-US", { dateStyle: "medium", timeZone: "UTC" });

export default async function DocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getDocument(id);
  if (!d) notFound();

  return (
    <>
      <div className="mb-2"><Link href="/app/legal" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" /> Legal</Link></div>
      <PageHeader
        eyebrow={CATEGORY_LABELS[d.category]}
        title={d.title}
        description={[d.counterparty, d.reference].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <DocumentForm doc={{ id: d.id, title: d.title, category: d.category, status: d.status, counterparty: d.counterparty ?? "", reference: d.reference ?? "", effectiveOn: d.effectiveOn ? d.effectiveOn.toISOString().slice(0, 10) : "", expiresOn: d.expiresOn ? d.expiresOn.toISOString().slice(0, 10) : "", noticeDays: d.noticeDays, amount: d.amountCents / 100, notes: d.notes ?? "" }} />
            {d.status !== "terminated" && <TerminateButton id={d.id} />}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PaperclipIcon className="size-5 text-oro" /> Archivos</CardTitle>
            <CardDescription>Guardados en privado. El enlace para verlos dura una hora.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {d.files.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay archivos. Subí el PDF o sacale una foto al papel.</p>
            ) : (
              <ul className="grid gap-2">
                {d.files.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2">
                      {f.contentType.startsWith("image/") ? <ImageIcon className="size-4 shrink-0 text-muted-foreground" /> : <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />}
                      {f.url ? <a href={f.url} target="_blank" rel="noreferrer" className="truncate text-sm text-oro-profundo hover:underline">{f.name}</a> : <span className="truncate text-sm">{f.name}</span>}
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">{(f.sizeBytes / 1024).toFixed(0)} KB</span>
                    </span>
                    <DeleteFileButton fileId={f.id} documentId={d.id} name={f.name} />
                  </li>
                ))}
              </ul>
            )}
            <FileUpload documentId={d.id} />
          </CardContent>
        </Card>

        <div className="grid gap-6 self-start">
          <Card>
            <CardHeader><CardTitle>Datos</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">Estado</span><Badge variant={d.status === "active" ? "success" : d.status === "draft" ? "secondary" : "outline"}>{STATUS_LABELS[d.status]}</Badge></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">Desde</span><span className="font-mono text-xs">{d.effectiveOn ? dateFmt.format(d.effectiveOn) : "—"}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">Vence</span><span className="font-mono text-xs">{d.expiresOn ? dateFmt.format(d.expiresOn) : "—"}</span></div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Vencimiento</span>
                <span>{d.state === "vencido" ? <Badge variant="destructive">{expiryLabel(d.days)}</Badge> : d.state === "por_vencer" ? <Badge variant="gold">{expiryLabel(d.days)}</Badge> : <span className="text-xs text-muted-foreground">{expiryLabel(d.days)}</span>}</span>
              </div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">Aviso previo</span><span className="font-mono text-xs">{d.noticeDays} días</span></div>
              {d.amountCents > 0 && <div className="flex justify-between gap-2"><span className="text-muted-foreground">Monto</span><span className="font-mono">{formatCents(d.amountCents)}</span></div>}
            </CardContent>
          </Card>
          {d.notes && (
            <Card>
              <CardHeader><CardTitle>Notas</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{d.notes}</p></CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
