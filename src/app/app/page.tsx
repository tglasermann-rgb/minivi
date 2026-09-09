import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { getSettings } from "@/lib/settings";
import { formatCents } from "@/lib/money";

const CARDS = [
  { title: "Ventas de la semana", description: "Contra el plan: 15 base · 12 conservador · 20 optimista", phase: 5 },
  { title: "Caja del mes", description: "Ventas cobradas − gastos − nómina − pagos a proveedores", phase: 6 },
  { title: "Stock", description: "Piezas, gramos y valor al público", phase: 1 },
  { title: "Cuentas por pagar", description: "Vencimientos de los próximos 7 días", phase: 2 },
  { title: "Fichados ahora", description: "Empleadas con entrada abierta", phase: 4 },
  { title: "Últimos gastos", description: "Los 5 más recientes", phase: 3 },
];

export default async function HomePage() {
  const settings = await getSettings();
  return (
    <>
      <PageHeader
        eyebrow="Inicio"
        title="Hola."
        description={`Precio por gramo vigente: ${formatCents(settings.precio_por_gramo)} · redondeo a ${formatCents(settings.redondeo_precio)}`}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CARDS.map((c) => (
          <Card key={c.title} className="min-h-36">
            <CardHeader>
              <CardTitle>{c.title}</CardTitle>
              <CardDescription>{c.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <p className="font-mono text-2xl text-arena">—</p>
              <p className="mt-1 text-xs text-muted-foreground">Fase {c.phase}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
