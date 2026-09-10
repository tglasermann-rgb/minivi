import Link from "next/link";
import { PaperclipIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Stat } from "@/components/ui/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCents } from "@/lib/money";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/legal/expiry";
import { ExpiryBadge } from "./expiry-badge";
import { listDocuments, type LegalFilters } from "@/lib/legal/service";
import { DocumentForm } from "./document-form";
import { LegalFiltersBar } from "./filters";

export const metadata = { title: "Legal" };
export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("es-US", { dateStyle: "medium", timeZone: "UTC" });

export default async function LegalPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const filters: LegalFilters = {
    q: sp.q ?? "",
    category: (sp.category as LegalFilters["category"]) ?? "",
    status: (sp.status as LegalFilters["status"]) ?? "",
    expiry: (sp.expiry as LegalFilters["expiry"]) ?? "",
  };
  const { rows, totals } = await listDocuments(filters);

  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Contratos y documentos"
        description="Todo el papeleo del negocio en un solo lugar, con aviso antes de cada vencimiento. Los archivos quedan privados."
        actions={<DocumentForm />}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Documentos" value={String(totals.total)} />
        <Stat label="Por vencer" value={String(totals.porVencer)} className={totals.porVencer ? "border-oro/60" : ""} hint="dentro del aviso previo" />
        <Stat label="Vencidos" value={String(totals.vencidos)} className={totals.vencidos ? "border-destructive/50" : ""} />
        <Stat label="Sin archivo adjunto" value={String(totals.sinArchivo)} hint="falta subir el papel" />
      </div>
      <LegalFiltersBar filters={filters} />
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Documento</TableHead><TableHead>Categoría</TableHead><TableHead>Con quién</TableHead>
              <TableHead>Vence</TableHead><TableHead className="text-right">Monto</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Archivos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No hay documentos con esos filtros. Empezá por el contrato de alquiler y la póliza del seguro.</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={`/app/legal/${r.id}`} className="text-oro-profundo hover:underline">{r.title}</Link>
                  {r.reference && <span className="block font-mono text-xs text-muted-foreground">{r.reference}</span>}
                </TableCell>
                <TableCell className="text-xs">{CATEGORY_LABELS[r.category]}</TableCell>
                <TableCell className="text-xs">{r.counterparty ?? "—"}</TableCell>
                <TableCell className="text-xs">
                  {r.expiresOn ? <span className="font-mono">{dateFmt.format(r.expiresOn)}</span> : null}
                  <span className="block"><ExpiryBadge state={r.state} days={r.days} /></span>
                </TableCell>
                <TableCell className="text-right font-mono text-xs">{r.amountCents ? formatCents(r.amountCents) : "—"}</TableCell>
                <TableCell><Badge variant={r.status === "active" ? "success" : r.status === "draft" ? "secondary" : "outline"}>{STATUS_LABELS[r.status]}</Badge></TableCell>
                <TableCell className="text-right">
                  {r.files > 0 ? <span className="inline-flex items-center gap-1 font-mono text-xs"><PaperclipIcon className="size-3.5" />{r.files}</span> : <span className="text-xs text-destructive">falta</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
