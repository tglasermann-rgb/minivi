import { PageHeader } from "@/components/layout/page-header";
import { getSettings } from "@/lib/settings";
import { ProductForm } from "../product-form";
import { listBaseProducts } from "../queries";

export const metadata = { title: "Nuevo producto" };
export const dynamic = "force-dynamic";

export default async function NuevoProductoPage() {
  const [s, bases] = await Promise.all([getSettings(), listBaseProducts()]);
  return (
    <>
      <PageHeader eyebrow="Inventario" title="Nuevo producto" description="El SKU y el precio se generan solos al guardar." />
      <ProductForm
        mode="create"
        pricing={{ pricePerGramCents: s.precio_por_gramo, roundingCents: s.redondeo_precio, costPerGramDefaultCents: s.costo_por_gramo_default, karatDefault: s.kilataje_default }}
        bases={bases.filter((b) => !b.optionValue || true)}
      />
    </>
  );
}
