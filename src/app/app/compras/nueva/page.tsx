import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { getSettings } from "@/lib/settings";
import { PurchaseForm } from "../purchase-form";
import { listSuppliers } from "../queries";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Nueva compra" };
export const dynamic = "force-dynamic";

export default async function NuevaCompraPage() {
  const [s, suppliers] = await Promise.all([getSettings(), listSuppliers(true)]);
  return (
    <>
      <PageHeader eyebrow="Compras" title="Nueva compra" description="Cargá las líneas como vienen en la factura del proveedor." />
      {suppliers.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="mb-3">Primero hay que cargar un proveedor.</p>
          <Button asChild variant="gold"><Link href="/app/compras/proveedores">Ir a Proveedores</Link></Button>
        </div>
      ) : (
        <PurchaseForm suppliers={suppliers} defaultCostPerGram={s.costo_por_gramo_default / 100} />
      )}
    </>
  );
}
