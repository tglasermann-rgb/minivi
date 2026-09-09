import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon, PrinterIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Stat } from "@/components/ui/stat";
import { getSettings } from "@/lib/settings";
import { formatCents } from "@/lib/money";
import { REASON_LABELS, STATUS_LABELS, TYPE_LABELS } from "@/lib/inventory/constants";
import { buildTags } from "@/lib/inventory/tags";
import { ProductForm } from "../product-form";
import { getProductDetail } from "../queries";
import { ProductActions } from "./product-actions";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("es-US", { dateStyle: "short", timeStyle: "short", timeZone: "America/New_York" });

export default async function ProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, s] = await Promise.all([getProductDetail(id), getSettings()]);
  if (!p) notFound();
  const shopDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const shopifyAdminUrl = p.shopifyProductId && shopDomain ? `https://${shopDomain.replace(".myshopify.com", "")}.myshopify.com/admin/products/${p.shopifyProductId.split("/").pop()}` : null;

  return (
    <>
      <div className="mb-2"><Link href="/app/inventario" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" /> Inventario</Link></div>
      <PageHeader
        eyebrow={`${TYPE_LABELS[p.type]} · ${p.subcategory}`}
        title={p.title + (p.optionValue ? ` · ${p.optionValue}` : "")}
        description={`SKU ${p.sku}`}
        actions={
          <>
            <Button asChild variant="outline"><a href={`/api/inventario/etiquetas?ids=${p.id}`} target="_blank" rel="noreferrer"><PrinterIcon /> Etiqueta</a></Button>
            <ProductActions productId={p.id} sku={p.sku} published={!!p.shopifyProductId} />
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Stock" value={String(p.stock)} className={p.stock <= 0 ? "border-destructive/40" : ""} />
        <Stat label="Gramos" value={`${p.grams.toFixed(2)} g`} />
        <Stat label="Costo" value={formatCents(p.costCents)} />
        <Stat label="Precio" value={formatCents(p.priceCents)} hint={p.priceOverride ? "manual" : "automático"} />
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Estado</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Badge variant={p.status === "active" ? "success" : p.status === "draft" ? "secondary" : "outline"}>{STATUS_LABELS[p.status]}</Badge>
            {p.shopifyProductId ? <Badge variant="gold">Shopify</Badge> : <Badge variant="outline">sin publicar</Badge>}
          </div>
        </div>
      </div>

      <Tabs defaultValue="datos">
        <TabsList>
          <TabsTrigger value="datos">Datos</TabsTrigger>
          <TabsTrigger value="stock">Stock ({p.movements.length})</TabsTrigger>
          <TabsTrigger value="fotos">Fotos ({p.images.length})</TabsTrigger>
          <TabsTrigger value="shopify">Shopify</TabsTrigger>
        </TabsList>

        <TabsContent value="datos" className="mt-4">
          {p.siblings.length > 0 && (
            <p className="mb-3 text-sm text-muted-foreground">
              Variantes del mismo producto: {p.siblings.map((sib, i) => (
                <span key={sib.id}>{i > 0 && ", "}<Link className="font-mono text-oro-profundo hover:underline" href={`/app/inventario/${sib.id}`}>{sib.sku}</Link></span>
              ))}
            </p>
          )}
          <ProductForm
            mode="edit"
            productId={p.id}
            lockedSku={p.sku}
            pricing={{ pricePerGramCents: s.precio_por_gramo, roundingCents: s.redondeo_precio, costPerGramDefaultCents: s.costo_por_gramo_default, karatDefault: s.kilataje_default }}
            defaultValues={{
              title: p.title,
              type: p.type,
              subcategory: p.subcategory as never,
              extraTags: p.extraTags as never,
              karat: p.karat as never,
              grams: p.grams,
              descriptionHtml: p.descriptionHtml,
              optionName: p.optionName ?? "",
              optionValue: p.optionValue ?? "",
              costMode: "total",
              costTotal: p.costCents / 100,
              costPerGram: p.grams > 0 ? Math.round(p.costCents / p.grams) / 100 : undefined,
              priceOverride: p.priceOverride,
              price: p.priceCents / 100,
              status: p.status,
              notes: p.notes ?? "",
            }}
          />
        </TabsContent>

        <TabsContent value="stock" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Movimientos de stock</CardTitle>
              <CardDescription>El stock actual ({p.stock}) es la suma de estos movimientos. Para corregir, usá &quot;Ajustar stock&quot;.</CardDescription>
            </CardHeader>
            <CardContent>
              {p.movements.length === 0 ? <p className="text-sm text-muted-foreground">Sin movimientos todavía.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Cuándo</TableHead><TableHead>Motivo</TableHead><TableHead className="text-right">Cantidad</TableHead><TableHead>Referencia</TableHead><TableHead>Nota</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {p.movements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">{dateFmt.format(m.createdAt)}</TableCell>
                        <TableCell>{REASON_LABELS[m.reason]}</TableCell>
                        <TableCell className={`text-right font-mono ${m.qty < 0 ? "text-destructive" : "text-emerald-700"}`}>{m.qty > 0 ? `+${m.qty}` : m.qty}</TableCell>
                        <TableCell className="font-mono text-xs">{m.reference ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{m.note ?? ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fotos" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Fotos</CardTitle>
              <CardDescription>Se buscan en Drive por nombre de archivo ({p.sku}.jpg, {p.sku}-2.jpg) o en una carpeta llamada {p.sku}, y se copian al bucket público para Shopify.</CardDescription>
            </CardHeader>
            <CardContent>
              {p.images.length === 0 ? <p className="text-sm text-muted-foreground">Sin fotos. Usá &quot;Buscar fotos&quot; arriba.</p> : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                  {p.images.map((img) => (
                    <a key={img.id} href={img.publicUrl} target="_blank" rel="noreferrer" className="group relative aspect-square overflow-hidden rounded-md border bg-muted">
                      <Image src={img.publicUrl} alt={img.fileName} fill unoptimized className="object-cover transition-transform group-hover:scale-105" />
                      <span className="absolute bottom-1 left-1 rounded bg-tinta/70 px-1 font-mono text-[10px] text-crema">{img.position}</span>
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shopify" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Shopify</CardTitle>
              <CardDescription>Lo que se manda al publicar. Shopify es la fuente de verdad de lo publicado.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="grid gap-1 sm:grid-cols-[160px_1fr]">
                <span className="text-muted-foreground">Handle</span><span className="font-mono">{p.handle}</span>
                <span className="text-muted-foreground">Tags</span><span className="font-mono text-xs">{buildTags(p.type, p.subcategory, p.extraTags, p.karat).join(", ")}</span>
                <span className="text-muted-foreground">Product ID</span><span className="font-mono text-xs">{p.shopifyProductId ?? "—"}</span>
                <span className="text-muted-foreground">Variant ID</span><span className="font-mono text-xs">{p.shopifyVariantId ?? "—"}</span>
                <span className="text-muted-foreground">Inventory item</span><span className="font-mono text-xs">{p.shopifyInventoryItemId ?? "—"}</span>
                <span className="text-muted-foreground">Última sincronización</span><span className="font-mono text-xs">{p.shopifySyncedAt ? dateFmt.format(p.shopifySyncedAt) : "nunca"}</span>
              </div>
              {shopifyAdminUrl && (
                <Button asChild variant="outline" className="w-fit"><a href={shopifyAdminUrl} target="_blank" rel="noreferrer">Abrir en el admin de Shopify <ExternalLinkIcon /></a></Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
