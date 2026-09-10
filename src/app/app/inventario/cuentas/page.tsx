import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { InventarioNav } from "../section-nav";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Stat } from "@/components/ui/stat";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/money";
import { listPayables } from "../entradas/queries";
import { PayableRowActions } from "../entradas/[id]/detail-actions";

export const metadata = { title: "Cuentas por pagar" };
export const dynamic = "force-dynamic";
const dateFmt = new Intl.DateTimeFormat("es-US", { dateStyle: "medium", timeZone: "UTC" });

export default async function CuentasPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const filter = f === "paid" ? "paid" : f === "all" ? "all" : "pending";
  const { rows, pendingCents } = await listPayables(filter);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const in7 = new Date(today); in7.setUTCDate(in7.getUTCDate() + 7);
  const overdue = rows.filter((r) => !r.paidOn && r.dueOn < today).reduce((s, r) => s + r.amountCents, 0);
  const soon = rows.filter((r) => !r.paidOn && r.dueOn >= today && r.dueOn <= in7).reduce((s, r) => s + r.amountCents, 0);

  return (
    <>
      <InventarioNav />
      <PageHeader eyebrow="Compras" title="Cuentas por pagar" description="Cuotas generadas por las condiciones de pago de cada compra." />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Pendiente total" value={formatCents(pendingCents)} />
        <Stat label="Vencido" value={formatCents(overdue)} className={overdue > 0 ? "border-destructive/50" : ""} />
        <Stat label="Vence en 7 días" value={formatCents(soon)} className={soon > 0 ? "border-oro/60" : ""} />
      </div>
      <div className="mb-3 flex gap-2">
        {(["pending", "paid", "all"] as const).map((k) => (
          <Button key={k} asChild size="sm" variant={filter === k ? "default" : "outline"}><Link href={`/app/inventario/cuentas?f=${k}`}>{k === "pending" ? "Pendientes" : k === "paid" ? "Pagadas" : "Todas"}</Link></Button>
        ))}
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Vence</TableHead><TableHead>Compra</TableHead><TableHead>Proveedor</TableHead><TableHead className="text-right">Monto</TableHead><TableHead>Pagado</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Nada por acá.</TableCell></TableRow>}
            {rows.map((r) => {
              const late = !r.paidOn && r.dueOn < today;
              return (
                <TableRow key={r.id}>
                  <TableCell className={`font-mono text-xs ${late ? "text-destructive" : ""}`}>{dateFmt.format(r.dueOn)}{late && " · vencida"}</TableCell>
                  <TableCell className="font-mono text-xs"><Link href={`/app/inventario/entradas/${r.purchaseId}`} className="text-oro-profundo hover:underline">PO-{String(r.purchase.number).padStart(4, "0")}</Link></TableCell>
                  <TableCell>{r.purchase.supplier.name}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatCents(r.amountCents)}</TableCell>
                  <TableCell className="text-xs">{r.paidOn ? <span className="text-emerald-700">{dateFmt.format(r.paidOn)}{r.method ? ` · ${r.method}` : ""}</span> : <span className="text-muted-foreground">pendiente</span>}</TableCell>
                  <TableCell className="text-right"><PayableRowActions id={r.id} paid={!!r.paidOn} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
