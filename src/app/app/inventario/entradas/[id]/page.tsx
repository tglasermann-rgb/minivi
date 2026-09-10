import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, FileTextIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Stat } from "@/components/ui/stat";
import { formatCents } from "@/lib/money";
import { TYPE_LABELS } from "@/lib/inventory/constants";
import { getPurchase } from "../queries";
import { PURCHASE_STATUS_LABELS } from "../constants";
import { PayableRowActions, AttachmentUpload } from "./detail-actions";

export const dynamic = "force-dynamic";
const dateFmt = new Intl.DateTimeFormat("es-US", { dateStyle: "medium", timeZone: "UTC" });
const variant = { draft: "secondary", ordered: "gold", received: "success", closed: "outline" } as const;

export default async function CompraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getPurchase(id);
  if (!p) notFound();
  const pendingCents = p.payables.filter((x) => !x.paidOn).reduce((s, x) => s + x.amountCents, 0);
  const units = p.items.reduce((s, i) => s + i.qty, 0);
  const nuevas = p.items.filter((i) => i.productId).length;
  const grams = p.items.reduce((s, i) => s + i.grams * i.qty, 0);

  return (
    <>
      <div className="mb-2"><Link href="/app/inventario/entradas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" /> Entradas</Link></div>
      <PageHeader
        eyebrow={`${p.supplier.name} · ${dateFmt.format(p.date)}`}
        title={`PO-${String(p.number).padStart(4, "0")}`}
        description={`Base ${formatCents(p.costPerGramCents)}/g${p.invoiceNumber ? ` · factura ${p.invoiceNumber}` : ""}`}
        actions={<Button asChild variant="outline"><a href={`/api/compras?id=${p.id}`} target="_blank" rel="noreferrer"><FileTextIcon /> PDF</a></Button>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Estado</p>
          <div className="mt-1.5"><Badge variant={variant[p.status]}>{PURCHASE_STATUS_LABELS[p.status]}</Badge></div>
        </div>
        <Stat label="Unidades" value={String(units)} hint={`${nuevas} de ${p.items.length} piezas`} />
        <Stat label="Gramos" value={`${grams.toFixed(2)} g`} />
        <Stat label="Total" value={formatCents(p.totalCents)} hint={`subtotal ${formatCents(p.subtotalCents)}`} />
        <Stat label="Pendiente de pago" value={formatCents(pendingCents)} className={pendingCents > 0 ? "border-oro/50" : ""} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Piezas</CardTitle>
          <CardDescription>La entrada ya movió stock, así que no se edita. Para corregir algo, entrá a la pieza en Inventario.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Descripción</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Gramos</TableHead><TableHead className="text-right">Cant.</TableHead><TableHead className="text-right">+ por g</TableHead><TableHead className="text-right">Costo unit.</TableHead><TableHead className="text-right">Total</TableHead><TableHead>SKU</TableHead></TableRow></TableHeader>
            <TableBody>
              {p.items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-xs">{i.position}</TableCell>
                  <TableCell>{i.description}{i.optionValue && <span className="text-muted-foreground"> · {i.optionValue}</span>}</TableCell>
                  <TableCell className="text-xs">{TYPE_LABELS[i.type]} / {i.subcategory}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{i.grams.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{i.qty}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {i.unitCostOverride ? <span className="text-muted-foreground">cerrado</span> : i.premiumCents > 0 ? `+${formatCents(i.premiumCents)}` : <span className="text-muted-foreground">base</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatCents(i.unitCostCents)}
                    {!i.unitCostOverride && <span className="block text-[10px] text-muted-foreground">{formatCents(p.costPerGramCents + i.premiumCents)}/g</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatCents(i.unitCostCents * i.qty)}</TableCell>
                  <TableCell className="font-mono text-xs">{i.productId && i.sku ? <Link href={`/app/inventario/${i.productId}`} className="text-oro-profundo hover:underline">{i.sku}</Link> : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Cuentas por pagar</CardTitle><CardDescription>Las fechas que pusiste al cargar la entrada.</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Vence</TableHead><TableHead className="text-right">Monto</TableHead><TableHead>Pagado</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {p.payables.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell className="font-mono text-xs">{dateFmt.format(x.dueOn)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatCents(x.amountCents)}</TableCell>
                    <TableCell className="text-xs">{x.paidOn ? <span className="text-emerald-700">{dateFmt.format(x.paidOn)}{x.method ? ` · ${x.method}` : ""}</span> : <span className="text-muted-foreground">pendiente</span>}</TableCell>
                    <TableCell className="text-right"><PayableRowActions id={x.id} paid={!!x.paidOn} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Adjuntos</CardTitle><CardDescription>Factura escaneada, fotos del paquete. Bucket privado.</CardDescription></CardHeader>
          <CardContent className="grid gap-3">
            {p.attachments.length === 0 && <p className="text-sm text-muted-foreground">Sin archivos.</p>}
            <ul className="grid gap-1 text-sm">
              {p.attachments.map((a) => (
                <li key={a.path} className="flex items-center justify-between gap-2 border-b py-1 last:border-0">
                  {a.url ? <a className="truncate text-oro-profundo hover:underline" href={a.url} target="_blank" rel="noreferrer">{a.name}</a> : <span className="truncate">{a.name}</span>}
                  <span className="font-mono text-xs text-muted-foreground">{(a.size / 1024).toFixed(0)} KB</span>
                </li>
              ))}
            </ul>
            <AttachmentUpload purchaseId={p.id} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
