import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { getSettings } from "@/lib/settings";
import { formatCents } from "@/lib/money";
import { upcomingPayables } from "@/lib/purchases/service";
import { prisma } from "@/lib/prisma";
import { whoIsIn } from "@/lib/payroll/service";
import { WeeklyMetric } from "@/components/sales/weekly-metric";
import { monthReport, stockSnapshot, stopRule } from "@/lib/reports/service";
import { yearMonthOf, monthLabel } from "@/lib/expenses/budget";
import { Stat } from "@/components/ui/stat";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { safe } from "@/lib/safe";
import { expiringDocuments } from "@/lib/legal/service";
import { CATEGORY_LABELS, expiryLabel } from "@/lib/legal/expiry";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function HomePage() {
  const settings = await getSettings();
  const month = yearMonthOf(new Date(), settings.tienda_timezone);
  // Cada bloque se pide por separado: si uno falla, muestra vacío en vez de romper la pantalla.
  const [payables, lastExpenses, inNow, report, stock, rule, legal] = await Promise.all([
    safe("cuentas por pagar", () => upcomingPayables(7), [] as Awaited<ReturnType<typeof upcomingPayables>>),
    safe("últimos gastos", () => prisma.expense.findMany({ include: { category: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 5 }), []),
    safe("fichadas ahora", whoIsIn, [] as Awaited<ReturnType<typeof whoIsIn>>),
    safe("reporte del mes", () => monthReport(month), null),
    safe("stock", stockSnapshot, null),
    safe("regla de parada", stopRule, null),
    safe("documentos legales", expiringDocuments, [] as Awaited<ReturnType<typeof expiringDocuments>>),
  ]);
  const timeFmt = new Intl.DateTimeFormat("es-US", { hour: "2-digit", minute: "2-digit", timeZone: settings.tienda_timezone });
  const stopRow = rule?.rows.find((x) => x.month === month);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const dateFmt = new Intl.DateTimeFormat("es-US", { dateStyle: "medium", timeZone: "UTC" });
  return (
    <>
      <PageHeader
        eyebrow="Inicio"
        title="Hola."
        description={`Precio por gramo vigente: ${formatCents(settings.precio_por_gramo)} · redondeo a ${formatCents(settings.redondeo_precio)}`}
      />
      <div className="mb-4"><WeeklyMetric compact /></div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={`Caja de ${monthLabel(month)}`} value={report ? formatCents(report.cashFlowCents) : "—"} hint="ventas − gastos − nómina − proveedores" className={report && report.cashFlowCents < 0 ? "border-destructive/50" : ""} />
        <Stat label="Ventas netas del mes" value={report ? formatCents(report.salesNetCents) : "—"} hint={report ? `${report.salesOrders} órdenes · margen ${formatCents(report.marginCents)}` : undefined} />
        <Stat label="Stock" value={stock ? `${stock.grams.toFixed(0)} g` : "—"} hint={stock ? `${stock.pieces} piezas · costo ${formatCents(stock.costCents)} · público ${formatCents(stock.priceCents)}` : undefined} />
        <Stat label="Regla de parada" value={stopRow && stopRow.status !== "future" ? formatCents(stopRow.deltaCents) : "—"} hint={stopRow && stopRow.status !== "future" ? `caja real ${formatCents(stopRow.cashCents)} vs objetivo ${formatCents(stopRow.targetCents)}` : "antes de la apertura"} className={stopRow?.status === "red" ? "border-destructive" : stopRow?.status === "warn" ? "border-oro" : ""} />
      </div>
      {legal.length > 0 && (
        <Card className={`mb-4 ${legal.some((x) => x.state === "vencido") ? "border-destructive/60" : "border-oro/60"}`}>
          <CardHeader>
            <CardTitle>Contratos y documentos por vencer</CardTitle>
            <CardDescription>Renová o avisá a tiempo. <Link href="/app/legal" className="text-oro-profundo hover:underline">Ver todos</Link></CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {legal.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 border-b py-1 last:border-0">
                  <span className="flex min-w-0 items-center gap-2">
                    {x.state === "vencido" ? <Badge variant="destructive">vencido</Badge> : <Badge variant="gold">{expiryLabel(x.days)}</Badge>}
                    <Link href={`/app/legal/${x.id}`} className="truncate hover:underline">{x.title}</Link>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{CATEGORY_LABELS[x.category]}</span>
                  </span>
                  {x.expiresOn && <span className="shrink-0 font-mono text-xs">{dateFmt.format(x.expiresOn)}</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
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
        <Card>
          <CardHeader>
            <CardTitle>Últimos gastos</CardTitle>
            <CardDescription><Link href="/app/gastos" className="text-oro-profundo hover:underline">Cargar o ver todos</Link></CardDescription>
          </CardHeader>
          <CardContent>
            {lastExpenses.length === 0 ? <p className="text-sm text-muted-foreground">Sin gastos cargados.</p> : (
              <ul className="grid gap-1 text-sm">
                {lastExpenses.map((e) => <li key={e.id} className="flex justify-between gap-2 border-b py-1 last:border-0"><span className="truncate">{e.vendor} <span className="text-muted-foreground">· {e.category.name}</span></span><span className="font-mono text-xs">{formatCents(e.amountCents)}</span></li>)}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fichadas ahora</CardTitle>
            <CardDescription><Link href="/app/empleados" className="text-oro-profundo hover:underline">Empleados y nómina</Link></CardDescription>
          </CardHeader>
          <CardContent>
            {inNow.length === 0 ? <p className="text-sm text-muted-foreground">Nadie fichado en este momento.</p> : (
              <ul className="grid gap-1 text-sm">{inNow.map((e) => <li key={e.id} className="flex justify-between border-b py-1 last:border-0"><span>{e.employee.name}</span><span className="font-mono text-xs">desde {timeFmt.format(e.clockIn)}</span></li>)}</ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
