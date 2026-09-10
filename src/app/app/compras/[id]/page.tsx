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
import { TERMS_LABELS, type PaymentTerms } from "@/lib/purchases/terms";
import { getPurchase, listSuppliers } from "../queries";
import { PURCHASE_STATUS_LABELS } from "../constants";
import { PurchaseForm } from "../purchase-form";
import { PurchaseDetailActions, PayableRowActions, AttachmentUpload } from "./detail-actions";

export const dynamic = "force-dynamic";
const dateFmt = new Intl.DateTimeFormat("es-US", { dateStyle: "medium", timeZone: "UTC" });
const variant = { draft: "secondary", ordered: "gold", received: "success", closed: "outline" } as const;

export default async function CompraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getPurchase(id);
  if (!p) notFound();
  const editable = (p.status === "draft" || p.status === "ordered") && p.items.every((i) => i.qtyReceived === 0) && p.payables.every((x) => !x.paidOn);
  const suppliers = editable ? await listSuppliers(false) : [];
  const pendingCents = p.payables.filter((x) => !x.paidOn).reduce((s, x) => s + x.amountCents, 0);
  const units = p.items.reduce((s, i) => s + i.qty, 0);
  const received = p.items.reduce((s, i) => s + i.qtyReceived, 0);
  const grams = p.items.reduce((s, i) => s + i.grams * i.qty, 0);

  return (
    <>
      <div className="mb-2"><Link href="/app/compras" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" /> Compras</Link></div>
      <PageHeader
        eyebrow={`${p.supplier.name} · ${dateFmt.format(p.date)}`}
        title={`PO-${String(p.number).padStart(4, "0")}`}
        description={`${TERMS_LABELS[p.paymentTerms as PaymentTerms] ?? p.paymentTerms} · base ${formatCents(p.costPerGramCents)}/g${p.invoiceNumber ? ` · factura ${p.invoiceNumber}` : ""}`}
        actions={
          <>
            <Button asChild variant="outline"><a href={`/api/compras?id=${p.id}`} target="_blank" rel="noreferrer"><FileTextIcon /> PDF</a></Button>
            <PurchaseDetailActions purchase={{ id: p.id, status: p.status, items: p.items.map((i) => ({ id: i.id, description: i.description, qty: i.qty, qtyReceived: i.qtyReceived, sku: i.sku })) }} />
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Estado</p>
          <div className="mt-1.5"><Badge variant={variant[p.status]}>{PURCHASE_STATUS_LABELS[p.status]}</Badge></div>
        </div>
        <Stat label="Unidades recibidas" value={`${received} / ${units}`} />
        <Stat label="Gramos" value={`${grams.toFixed(2)} g`} />
        <Stat label="Total" value={formatCents(p.totalCents)} hint={`subtotal ${formatCents(p.subtotalCents)}`} />
        <Stat label="Pendiente de pago" value={formatCents(pendingCents)} className={pendingCents > 0 ? "border-oro/50" : ""} />
      </div>

      {editable ? (
        <PurchaseForm
          purchaseId={p.id}
          suppliers={suppliers}
          defaultCostPerGram={p.costPerGramCents / 100}
          defaultValues={{
            supplierId: p.supplierId,
            date: p.date.toISOString().slice(0, 10),
            invoiceNumber: p.invoiceNumber ?? "",
            costPerGram: p.costPerGramCents / 100,
            tax: p.taxCents / 100,
            shipping: p.shippingCents / 100,
            paymentTerms: p.paymentTerms as PaymentTerms,
            customInstallments: p.paymentTerms === "custom" ? p.payables.map((x) => ({ amount: x.amountCents / 100, dueOn: x.dueOn.toISOString().slice(0, 10) })) : [],
            notes: p.notes ?? "",
            items: p.items.map((i) => ({
              description: i.description, type: i.type, subcategory: i.subcategory as never, karat: i.karat as never, grams: i.grams, qty: i.qty,
              premium: i.premiumCents / 100,
              unitCost: i.unitCostOverride ? i.unitCostCents / 100 : undefined, optionName: i.optionName ?? "", optionValue: i.optionValue ?? "",
            })),
          }}
        />
      ) : (
        <Card>
          <CardHeader><CardTitle>Líneas</CardTitle><CardDescription>La compra ya tiene recepciones o pagos: no se edita.</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Descripción</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Gramos</TableHead><TableHead className="text-right">Cant.</TableHead><TableHead className="text-right">Recibido</TableHead><TableHead className="text-right">+ por g</TableHead><TableHead className="text-right">Costo unit.</TableHead><TableHead className="text-right">Total</TableHead><TableHead>SKU</TableHead></TableRow></TableHeader>
              <TableBody>
                {p.items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.position}</TableCell>
                    <TableCell>{i.description}{i.optionValue && <span className="text-muted-foreground"> · {i.optionValue}</span>}</TableCell>
                    <TableCell className="text-xs">{TYPE_LABELS[i.type]} / {i.subcategory}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{i.grams.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{i.qty}</TableCell>
                    <TableCell className={`text-right font-mono text-xs ${i.qtyReceived < i.qty ? "text-oro-profundo" : ""}`}>{i.qtyReceived}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {i.unitCostOverride ? <span className="text-muted-foreground">manual</span> : i.premiumCents > 0 ? `+${formatCents(i.premiumCents)}` : <span className="text-muted-foreground">base</span>}
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
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Cuentas por pagar</CardTitle><CardDescription>Generadas según las condiciones de pago.</CardDescription></CardHeader>
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
