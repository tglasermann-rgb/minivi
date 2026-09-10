import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { NewCountButton } from "./new-count";

export const metadata = { title: "Conteo físico" };
export const dynamic = "force-dynamic";
const dt = new Intl.DateTimeFormat("es-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });

export default async function ConteosPage() {
  const counts = await prisma.inventoryCount.findMany({ include: { lines: { select: { counted: true, expected: true, adjusted: true } } }, orderBy: { createdAt: "desc" }, take: 50 });
  return (
    <>
      <div className="mb-2"><Link href="/app/inventario" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" /> Inventario</Link></div>
      <PageHeader eyebrow="Inventario" title="Conteo físico" description="Escaneá cada etiqueta con la cámara del celular. Al cerrar, muestra faltantes y sobrantes contra el sistema." actions={<NewCountButton />} />
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Nota</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Contadas</TableHead><TableHead className="text-right">Diferencias</TableHead></TableRow></TableHeader>
          <TableBody>
            {counts.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Ningún conteo todavía.</TableCell></TableRow>}
            {counts.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs"><Link href={`/app/inventario/conteo/${c.id}`} className="text-oro-profundo hover:underline">{dt.format(c.createdAt)}</Link></TableCell>
                <TableCell className="text-xs">{c.note ?? "—"}</TableCell>
                <TableCell><Badge variant={c.status === "open" ? "gold" : "outline"}>{c.status === "open" ? "abierto" : "cerrado"}</Badge></TableCell>
                <TableCell className="text-right font-mono text-xs">{c.lines.reduce((s, l) => s + l.counted, 0)}</TableCell>
                <TableCell className="text-right font-mono text-xs">{c.status === "closed" ? c.lines.filter((l) => l.expected != null && l.counted !== l.expected).length : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
