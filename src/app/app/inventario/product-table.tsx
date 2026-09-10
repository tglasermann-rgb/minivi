"use client";
import Link from "next/link";
import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ImageIcon, ImagesIcon, PrinterIcon, StoreIcon, DownloadIcon, ArchiveIcon, CheckCircle2Icon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatCents } from "@/lib/money";
import { STATUS_LABELS, TYPE_LABELS } from "@/lib/inventory/constants";
import { findPhotosAction, publishShopifyAction, setStatusAction } from "./actions";
import type { ProductRow } from "./queries";

const statusVariant = { draft: "secondary", active: "success", archived: "outline" } as const;

export function ProductTable({ rows }: { rows: ProductRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const ids = useMemo(() => Array.from(selected), [selected]);
  const idsParam = encodeURIComponent(ids.join(","));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }
  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }
  function run(label: string, fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const t = toast.loading(label);
      const r = await fn();
      toast.dismiss(t);
      if (r.ok) toast.success(r.message ?? "Listo");
      else toast.error(r.error ?? "Error");
    });
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <span className="text-sm text-muted-foreground">{ids.length ? `${ids.length} seleccionado(s)` : `${rows.length} producto(s)`}</span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" disabled={!ids.length} asChild={ids.length > 0}>
            {ids.length ? <a href={`/api/inventario/etiquetas?ids=${idsParam}`} target="_blank" rel="noreferrer"><PrinterIcon /> Etiquetas</a> : <span><PrinterIcon /> Etiquetas</span>}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={!ids.length}><DownloadIcon /> Exportar</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild><a href={`/api/inventario/export?format=shopify&ids=${idsParam}`}>CSV para Shopify</a></DropdownMenuItem>
              <DropdownMenuItem asChild><a href={`/api/inventario/export?format=tiktok&ids=${idsParam}`}>CSV para TikTok Shop</a></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" disabled={!ids.length || pending} onClick={() => run("Buscando fotos en Drive…", () => findPhotosAction(ids))}>
            <ImagesIcon /> Buscar fotos
          </Button>
          <Button size="sm" variant="outline" disabled={!ids.length || pending} onClick={() => run("Publicando en Shopify…", () => publishShopifyAction(ids))}>
            <StoreIcon /> Publicar en Shopify
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={!ids.length || pending}>Estado</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => run("Activando…", () => setStatusAction(ids, "active"))}><CheckCircle2Icon /> Marcar activos</DropdownMenuItem>
              <DropdownMenuItem onClick={() => run("Pasando a borrador…", () => setStatusAction(ids, "draft"))}>Marcar borrador</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => run("Archivando…", () => setStatusAction(ids, "archived"))}><ArchiveIcon /> Archivar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"><Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Seleccionar todo" /></TableHead>
            <TableHead className="w-12"></TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Gramos</TableHead>
            <TableHead className="text-right">Costo</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Shopify</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={11} className="py-10 text-center text-muted-foreground">No hay productos con esos filtros.</TableCell></TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
              <TableCell><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} aria-label={`Seleccionar ${r.sku}`} /></TableCell>
              <TableCell>
                {r.imageUrl ? (
                  <Image src={r.imageUrl} alt="" width={36} height={36} className="size-9 rounded object-cover" unoptimized />
                ) : (
                  <span className="flex size-9 items-center justify-center rounded bg-muted text-muted-foreground"><ImageIcon className="size-4" /></span>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs"><Link href={`/app/inventario/${r.id}`} className="text-oro-profundo hover:underline">{r.sku}</Link></TableCell>
              <TableCell className="max-w-64 truncate">
                <Link href={`/app/inventario/${r.id}`} className="hover:underline">{r.title}</Link>
                {r.optionValue && <span className="ml-1 text-xs text-muted-foreground">· {r.optionValue}</span>}
              </TableCell>
              <TableCell className="text-xs">{TYPE_LABELS[r.type]} <span className="text-muted-foreground">/ {r.subcategory}</span></TableCell>
              <TableCell className="text-right font-mono text-xs">{r.grams.toFixed(2)}</TableCell>
              <TableCell className="text-right font-mono text-xs">{formatCents(r.costCents)}</TableCell>
              <TableCell className="text-right font-mono text-xs">{formatCents(r.priceCents)}{r.priceOverride && <span title="Precio manual" className="ml-1 text-oro">*</span>}</TableCell>
              <TableCell className={`text-right font-mono text-xs ${r.stock <= 0 ? "text-destructive" : ""}`}>{r.stock}</TableCell>
              <TableCell><Badge variant={statusVariant[r.status]}>{STATUS_LABELS[r.status]}</Badge></TableCell>
              <TableCell className="text-xs">{r.shopifyProductId ? <Badge variant="gold">publicado</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
