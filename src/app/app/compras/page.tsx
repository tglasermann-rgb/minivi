import Link from "next/link";
import { PlusIcon, UsersIcon, WalletIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCents } from "@/lib/money";
import { listPurchases } from "./queries";
import { PURCHASE_STATUS_LABELS } from "./constants";

export const metadata = { title: "Compras" };
export const dynamic = "force-dynamic";

const variant = { draft: "secondary", ordered: "gold", received: "success", closed: "outline" } as const;
const dateFmt = new Intl.DateTimeFormat("es-US", { dateStyle: "medium", timeZone: "UTC" });

export default async function ComprasPage() {
  const rows = await listPurchases();
  return (
    <>
      <PageHeader
        eyebrow="Compras"
        title="Órdenes de compra"
        description="Cada compra tiene su costo por gramo. Al recibir, se crean los productos con SKU, precio y stock."
        actions={
          <>
            <Button asChild variant="outline"><Link href="/app/compras/proveedores"><UsersIcon /> Proveedores</Link></Button>
            <Button asChild variant="outline"><Link href="/app/compras/cuentas"><WalletIcon /> Cuentas por pagar</Link></Button>
            <Button asChild variant="gold"><Link href="/app/compras/nueva"><PlusIcon /> Nueva compra</Link></Button>
          </>
        }
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
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Todavía no hay compras.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs"><Link href={`/app/compras/${r.id}`} className="text-oro-profundo hover:underline">PO-{String(r.number).padStart(4, "0")}</Link></TableCell>
                <TableCell className="font-mono text-xs">{dateFmt.format(r.date)}</TableCell>
                <TableCell>{r.supplier}</TableCell>
                <TableCell><Badge variant={variant[r.status]}>{PURCHASE_STATUS_LABELS[r.status]}</Badge></TableCell>
                <TableCell className="text-right font-mono text-xs">{r.unitsReceived}/{r.units}</TableCell>
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
