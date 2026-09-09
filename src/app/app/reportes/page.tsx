import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { formatCents } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { inventoryAverageCostPerGram } from "@/lib/purchases/service";

export const metadata = { title: "Reportes" };
export const dynamic = "force-dynamic";

export default async function ReportesPage() {
  const [avg, s] = await Promise.all([inventoryAverageCostPerGram(), getSettings()]);
  const marginPerGram = s.precio_por_gramo - avg.avgCentsPerGram;
  return (
    <>
      <PageHeader eyebrow="Reportes" title="Reportes" description="Los reportes mensuales, la regla de parada y el export contable llegan en la fase 6." />
      <Card>
        <CardHeader>
          <CardTitle>Costo del inventario actual</CardTitle>
          <CardDescription>Promedio ponderado por gramos en stock. Compará contra el precio por gramo vigente ({formatCents(s.precio_por_gramo)}/g).</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Piezas en stock" value={String(avg.pieces)} />
          <Stat label="Gramos en stock" value={`${avg.grams.toFixed(2)} g`} />
          <Stat label="Costo promedio por gramo" value={avg.avgCentsPerGram ? `${formatCents(avg.avgCentsPerGram)}/g` : "—"} hint={`costo total ${formatCents(avg.costCents)}`} />
          <Stat label="Margen por gramo" value={avg.avgCentsPerGram ? `${formatCents(marginPerGram)}/g` : "—"} hint={avg.avgCentsPerGram ? `${Math.round((marginPerGram / avg.avgCentsPerGram) * 100)}% sobre costo` : undefined} />
        </CardContent>
      </Card>
    </>
  );
}
