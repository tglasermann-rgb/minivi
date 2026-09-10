import Link from "next/link";
import { PlusIcon, ScanBarcodeIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/ui/stat";
import { formatCents } from "@/lib/money";
import { listProducts, type InventoryFilters } from "./queries";
import { InventoryFiltersBar } from "./filters";
import { ProductTable } from "./product-table";

export const metadata = { title: "Inventario" };
export const dynamic = "force-dynamic";

export default async function InventarioPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const filters: InventoryFilters = {
    q: sp.q ?? "",
    type: (sp.type as InventoryFilters["type"]) ?? "",
    subcategory: sp.subcategory ?? "",
    status: (sp.status as InventoryFilters["status"]) ?? "",
    photo: (sp.photo as InventoryFilters["photo"]) ?? "",
    shopify: (sp.shopify as InventoryFilters["shopify"]) ?? "",
    stock: (sp.stock as InventoryFilters["stock"]) ?? "",
  };
  const { rows, totals } = await listProducts(filters);

  return (
    <>
      <PageHeader
        eyebrow="Inventario"
        title="Productos"
        description="El stock es la suma de movimientos. Shopify es la fuente de verdad de lo publicado."
        actions={
          <>
            <Button asChild variant="outline"><Link href="/app/inventario/conteo"><ScanBarcodeIcon /> Conteo físico</Link></Button>
            <Button asChild variant="gold"><Link href="/app/inventario/nuevo"><PlusIcon /> Nuevo producto</Link></Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Piezas en stock" value={String(totals.pieces)} hint={`${totals.skus} SKU`} />
        <Stat label="Gramos totales" value={`${totals.grams.toFixed(2)} g`} />
        <Stat label="Costo total" value={formatCents(totals.costCents)} />
        <Stat label="Precio al público" value={formatCents(totals.priceCents)} />
        <Stat label="Margen" value={formatCents(totals.priceCents - totals.costCents)} hint={totals.costCents ? `${Math.round(((totals.priceCents - totals.costCents) / totals.costCents) * 100)}% sobre costo` : undefined} />
      </div>
      <InventoryFiltersBar filters={filters} />
      <ProductTable rows={rows} />
    </>
  );
}
