import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getSettings } from "@/lib/settings";
import { listSuppliers } from "../queries";
import { IntakeForm } from "../intake-form";

export const metadata = { title: "Cargar mercadería" };
export const dynamic = "force-dynamic";

export default async function NuevaEntradaPage() {
  const [suppliers, settings] = await Promise.all([listSuppliers(true), getSettings()]);

  return (
    <>
      <div className="mb-2">
        <Link href="/app/inventario/entradas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> Entradas
        </Link>
      </div>
      <PageHeader
        eyebrow="Inventario"
        title="Cargar mercadería"
        description="La factura del proveedor y el alta en inventario en un solo paso. Al guardar, las piezas quedan en stock."
      />
      {suppliers.length === 0 ? (
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm">Primero cargá un proveedor: la factura tiene que ir a nombre de alguien.</p>
          <Button asChild variant="gold" className="mt-3"><Link href="/app/inventario/proveedores">Agregar proveedor</Link></Button>
        </div>
      ) : (
        <IntakeForm
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          defaultCostPerGram={settings.costo_por_gramo_default / 100}
          pricePerGramCents={settings.precio_por_gramo}
          roundingCents={settings.redondeo_precio}
        />
      )}
    </>
  );
}
