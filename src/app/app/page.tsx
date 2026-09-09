import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { getSettings } from "@/lib/settings";
import { formatCents } from "@/lib/money";
import { upcomingPayables } from "@/lib/purchases/service";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const CARDS = [
  { title: "Ventas de la semana", description: "Contra el plan: 15 base · 12 conservador · 20 optimista", phase: 5 },
  { title: "Caja del mes", description: "Ventas cobradas − gastos − nómina − pagos a proveedores", phase: 6 },
  { title: "Stock", description: "Piezas, gramos y valor al público", phase: 1 },
  { title: "Cuentas por pagar", description: "Vencimientos de los próximos 7 días", phase: 2 },
  { title: "Fichados ahora", description: "Empleadas con entrada abierta", phase: 4 },
  { title: "Últimos gastos", description: "Los 5 más recientes", phase: 3 },
];

export default async function HomePage() {
  const [settings, payables] = await Promise.all([getSettings(), upcomingPayables(7)]);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const dateFmt = new Intl.DateTimeFormat("es-US", { dateStyle: "medium", timeZone: "UTC" });
  return (
    <>
      <PageHeader
        eyebrow="Inicio"
        title="Hola."
        description={`Precio por gramo vigente: ${formatCents(settings.precio_por_gramo)} · redondeo a ${formatCents(settings.redondeo_precio)}`}
      />
      {payables.length > 0 && (
        <Card className="mb-4 border-oro/60">
          <CardHeader>
            <CardTitle>Cuentas por pagar próximas</CardTitle>
            <CardDescription>Vencen en los próximos 7 días o ya vencieron. <Link href="/app/compras/cuentas" className="text-oro-profundo hover:underline">Ver todas</Link></CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {payables.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 border-b py-1 last:border-0">
                  <span className="flex items-center gap-2">
                    {x.dueOn < today && <Badge variant="destructive">vencida</Badge>}
                    <span className="font-mono text-xs">{dateFmt.format(x.dueOn)}</span>
                    <Link href={`/app/compras/${x.purchaseId}`} className="hover:underline">PO-{String(x.purchase.number).padStart(4, "0")} · {x.purchase.supplier.name}</Link>
                  </span>
                  <span className="font-mono">{formatCents(x.amountCents)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CARDS.filter((c) => c.phase !== 2).map((c) => (
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
