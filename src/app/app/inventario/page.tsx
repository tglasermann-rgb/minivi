import Link from "next/link";
import { PackagePlusIcon, PlusIcon, ScanBarcodeIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/ui/stat";
import { formatCents } from "@/lib/money";
import { listProducts, type InventoryFilters } from "./queries";
import { InventoryFiltersBar } from "./filters";
import { ProductTable } from "./product-table";
import { InventarioNav } from "./section-nav";

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
      <InventarioNav />
      <PageHeader
        eyebrow="Inventario"
        title="Productos"
        description="Cada pieza con su SKU, precio y stock. Para sumar mercadería, cargá la factura del proveedor y las piezas entran solas."
        actions={
          <>
            <Button asChild variant="outline"><Link href="/app/inventario/conteo"><ScanBarcodeIcon /> Conteo físico</Link></Button>
            <Button asChild variant="outline"><Link href="/app/inventario/nuevo"><PlusIcon /> Pieza suelta</Link></Button>
            <Button asChild variant="gold"><Link href="/app/inventario/entradas/nueva"><PackagePlusIcon /> Cargar mercadería</Link></Button>
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
