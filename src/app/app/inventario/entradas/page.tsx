import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCents } from "@/lib/money";
import { listPurchases } from "./queries";
import { PURCHASE_STATUS_LABELS } from "./constants";
import { InventarioNav } from "../section-nav";

export const metadata = { title: "Entradas" };
export const dynamic = "force-dynamic";

const variant = { draft: "secondary", ordered: "gold", received: "success", closed: "outline" } as const;
const dateFmt = new Intl.DateTimeFormat("es-US", { dateStyle: "medium", timeZone: "UTC" });

export default async function EntradasPage() {
  const rows = await listPurchases();
  return (
    <>
      <InventarioNav />
      <PageHeader
        eyebrow="Inventario"
        title="Entradas de mercadería"
        description="Cada factura del proveedor con las piezas que trajo. Al cargarla, las piezas entran al stock."
        actions={<Button asChild variant="gold"><Link href="/app/inventario/entradas/nueva"><PlusIcon /> Cargar mercadería</Link></Button>}
      />
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead><TableHead>Fecha</TableHead><TableHead>Proveedor</TableHead><TableHead>Estado</TableHead>
              <TableHead className="text-right">Unidades</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Pendiente de pago</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Todavía no cargaste mercadería.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs"><Link href={`/app/inventario/entradas/${r.id}`} className="text-oro-profundo hover:underline">PO-{String(r.number).padStart(4, "0")}</Link></TableCell>
                <TableCell className="font-mono text-xs">{dateFmt.format(r.date)}</TableCell>
                <TableCell>{r.supplier}</TableCell>
                <TableCell><Badge variant={variant[r.status]}>{PURCHASE_STATUS_LABELS[r.status]}</Badge></TableCell>
                <TableCell className="text-right font-mono text-xs">{r.units}</TableCell>
                <TableCell className="text-right font-mono text-xs">{formatCents(r.totalCents)}</TableCell>
                <TableCell className={`text-right font-mono text-xs ${r.pendingCents > 0 ? "text-oro-profundo" : "text-muted-foreground"}`}>{formatCents(r.pendingCents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
