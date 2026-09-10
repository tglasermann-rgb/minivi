import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Stat } from "@/components/ui/stat";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { ClaimDialog } from "./claim-dialog";

export const metadata = { title: "Garantías" };
export const dynamic = "force-dynamic";
const d = new Intl.DateTimeFormat("es-US", { dateStyle: "medium", timeZone: "UTC" });

export default async function GarantiasPage() {
  const rows = await prisma.warrantyClaim.findMany({ orderBy: [{ status: "asc" }, { reportedOn: "desc" }], take: 300 });
  const open = rows.filter((r) => r.status === "open");
  return (
    <>
      <div className="mb-2"><Link href="/app/ventas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" /> Ventas</Link></div>
      <PageHeader eyebrow="Ventas" title="Garantías y reparaciones" description="Registro por SKU vendido para cumplir la garantía de 1 año publicada en la web. MiniVi no repara: acá queda qué pasó, qué se resolvió y cuánto costó." actions={<ClaimDialog />} />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Abiertas" value={String(open.length)} className={open.length ? "border-oro/60" : ""} />
        <Stat label="Resueltas" value={String(rows.length - open.length)} />
        <Stat label="Costo total" value={formatCents(rows.reduce((s, r) => s + r.costCents, 0))} />
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Reportado</TableHead><TableHead>SKU</TableHead><TableHead>Cliente</TableHead><TableHead>Problema</TableHead><TableHead>Resolución</TableHead><TableHead className="text-right">Costo</TableHead><TableHead>Estado</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Sin reclamos.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{d.format(r.reportedOn)}{r.soldOn && <span className="block text-muted-foreground">vendido {d.format(r.soldOn)}</span>}</TableCell>
                <TableCell className="font-mono text-xs">{r.productId ? <Link href={`/app/inventario/${r.productId}`} className="text-oro-profundo hover:underline">{r.sku}</Link> : r.sku}{r.orderNumber && <span className="block text-muted-foreground">{r.orderNumber}</span>}</TableCell>
                <TableCell className="text-xs">{r.customerName ?? "—"}{r.customerContact && <span className="block text-muted-foreground">{r.customerContact}</span>}</TableCell>
                <TableCell className="max-w-56 text-xs">{r.issue}</TableCell>
                <TableCell className="max-w-56 text-xs text-muted-foreground">{r.resolution ?? "—"}</TableCell>
                <TableCell className="text-right font-mono text-xs">{formatCents(r.costCents)}</TableCell>
                <TableCell><Badge variant={r.status === "open" ? "gold" : "success"}>{r.status === "open" ? "abierta" : "resuelta"}</Badge></TableCell>
                <TableCell className="text-right"><ClaimDialog claim={{ id: r.id, sku: r.sku, orderNumber: r.orderNumber ?? "", customerName: r.customerName ?? "", customerContact: r.customerContact ?? "", soldOn: r.soldOn ? r.soldOn.toISOString().slice(0, 10) : "", reportedOn: r.reportedOn.toISOString().slice(0, 10), issue: r.issue, resolution: r.resolution ?? "", cost: r.costCents / 100, status: r.status, notes: r.notes ?? "" }} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
