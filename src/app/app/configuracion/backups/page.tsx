import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listBackups } from "@/lib/extras/backup";
import { BackupNowButton } from "./backup-button";

export const metadata = { title: "Backups" };
export const dynamic = "force-dynamic";
const dt = new Intl.DateTimeFormat("es-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });

export default async function BackupsPage() {
  const rows = await listBackups();
  return (
    <>
      <div className="mb-2"><Link href="/app/configuracion" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" /> Configuración</Link></div>
      <PageHeader eyebrow="Configuración" title="Backups" description="Export completo de la base, comprimido, una vez por semana (domingos 09:00 UTC) en el bucket privado de Supabase. Se guardan los últimos 12." actions={<BackupNowButton />} />
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Archivo</TableHead><TableHead className="text-right">Tablas</TableHead><TableHead className="text-right">Filas</TableHead><TableHead className="text-right">Tamaño</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Sin backups todavía. Apretá &quot;Hacer backup ahora&quot;.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{dt.format(r.createdAt)}</TableCell>
                <TableCell className="font-mono text-xs">{r.url ? <a href={r.url} className="text-oro-profundo hover:underline">{r.path}</a> : r.path}</TableCell>
                <TableCell className="text-right font-mono text-xs">{r.tables}</TableCell>
                <TableCell className="text-right font-mono text-xs">{r.rows}</TableCell>
                <TableCell className="text-right font-mono text-xs">{(r.sizeBytes / 1024).toFixed(0)} KB</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
