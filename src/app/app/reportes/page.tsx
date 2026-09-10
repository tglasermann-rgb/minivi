import Link from "next/link";
import { DownloadIcon, FileTextIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stat } from "@/components/ui/stat";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCents } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { addMonths, monthLabel, yearMonthOf } from "@/lib/expenses/budget";
import { inventoryAverageCostPerGram } from "@/lib/purchases/service";
import { monthReport, stopRule } from "@/lib/reports/service";
import { TargetCell } from "./targets-editor";
import { metalValuation } from "@/lib/extras/gold";
import { GoldSpotButton } from "./gold-button";

export const metadata = { title: "Reportes" };
export const dynamic = "force-dynamic";

export default async function ReportesPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const s = await getSettings();
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : yearMonthOf(new Date(), s.tienda_timezone);
  const [r, rule, avg, metal] = await Promise.all([monthReport(month), stopRule(), inventoryAverageCostPerGram(), metalValuation()]);
  const spotDate = metal.spot ? new Intl.DateTimeFormat("es-US", { dateStyle: "medium", timeZone: "UTC" }).format(metal.spot.date) : null;
  const stopRow = rule.rows.find((x) => x.month === month);
  const from = `${month}-01`;
  const to = `${addMonths(month, 1)}-01`;
  const badge = (st: string) => st === "red" ? <Badge variant="destructive">rojo</Badge> : st === "warn" ? <Badge variant="gold">por debajo</Badge> : st === "ok" ? <Badge variant="success">ok</Badge> : <Badge variant="outline">futuro</Badge>;

  return (
    <>
      <PageHeader
        eyebrow="Reportes"
        title={`Reporte de ${monthLabel(month)}`}
        description={r.planMonth > 0 ? `Mes ${r.planMonth} del plan (apertura ${monthLabel(s.apertura_mes)}).` : `Antes de la apertura (${monthLabel(s.apertura_mes)}).`}
        actions={
          <>
            <Button asChild variant="outline"><a href={`/api/reportes?month=${month}`} target="_blank" rel="noreferrer"><FileTextIcon /> PDF del mes</a></Button>
            <Button asChild variant="outline"><a href={`/api/reportes?type=ventas&from=${from}&to=${to}`}><DownloadIcon /> Ventas CSV</a></Button>
            <Button asChild variant="outline"><a href={`/api/reportes?type=gastos&from=${from}&to=${to}`}><DownloadIcon /> Gastos CSV</a></Button>
            <Button asChild variant="outline"><a href={`/api/reportes?type=nomina&from=${from}&to=${to}`}><DownloadIcon /> Nómina CSV</a></Button>
          </>
        }
      />
      <div className="mb-4 flex items-center gap-2 text-sm">
        <Button asChild size="sm" variant="ghost"><Link href={`/app/reportes?m=${addMonths(month, -1)}`}>← {monthLabel(addMonths(month, -1))}</Link></Button>
        <span className="font-medium">{monthLabel(month)}</span>
        <Button asChild size="sm" variant="ghost"><Link href={`/app/reportes?m=${addMonths(month, 1)}`}>{monthLabel(addMonths(month, 1))} →</Link></Button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat label="Ventas netas" value={formatCents(r.salesNetCents)} hint={`${r.salesOrders} órdenes · ${r.salesUnits} piezas`} />
        <Stat label="Margen bruto" value={formatCents(r.marginCents)} hint={r.salesNetCents ? `${Math.round((r.marginCents / r.salesNetCents) * 100)}%` : undefined} />
        <Stat label="Gastos" value={formatCents(r.expensesCents)} hint={`plan ${formatCents(r.expensesBudgetCents)}`} className={r.expensesCents > r.expensesBudgetCents && r.expensesBudgetCents ? "border-destructive/50" : ""} />
        <Stat label="Nómina" value={formatCents(r.payrollCents)} hint={`plan ${formatCents(r.payrollBudgetCents)}`} />
        <Stat label="Resultado" value={formatCents(r.resultCents)} hint="margen − gastos − nómina" className={r.resultCents < 0 ? "border-destructive/50" : "border-emerald-600/40"} />
        <Stat label="Caja del mes" value={formatCents(r.cashFlowCents)} hint="ventas − gastos − nómina − proveedores" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Ventas por canal</CardTitle></CardHeader>
          <CardContent>
            {r.sales.length === 0 ? <p className="text-sm text-muted-foreground">Sin ventas en el mes.</p> : (
              <ul className="grid gap-1 text-sm">{r.sales.map((x) => <li key={x.channel} className="flex justify-between border-b py-1 last:border-0"><span>{x.label} <span className="text-muted-foreground">· {x.orders}</span></span><span className="font-mono">{formatCents(x.netCents)}</span></li>)}</ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">Costo de lo vendido {formatCents(r.costOfSalesCents)} · compras del mes {formatCents(r.purchasesCents)} · pagos a proveedores {formatCents(r.payablesPaidCents)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Gastos por categoría</CardTitle><CardDescription>Contra el presupuesto del plan.</CardDescription></CardHeader>
          <CardContent>
            {r.expenses.length === 0 ? <p className="text-sm text-muted-foreground">Sin gastos.</p> : (
              <ul className="grid gap-1 text-sm">{r.expenses.map((e) => <li key={e.category} className="flex justify-between border-b py-1 last:border-0"><span>{e.category}{e.group === "opening" && <span className="text-muted-foreground"> · apertura</span>}</span><span className="font-mono text-xs"><span className={e.budgetCents && e.cents > e.budgetCents ? "text-destructive" : ""}>{formatCents(e.cents)}</span>{e.budgetCents ? <span className="text-muted-foreground"> / {formatCents(e.budgetCents)}</span> : null}</span></li>)}</ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Regla de parada {stopRow && stopRow.status !== "future" && <span className="ml-2 align-middle">{badge(stopRow.status)}</span>}</CardTitle>
          <CardDescription>
            Caja real = caja inicial ({formatCents(rule.initialCents)}) + caja de cada mes. Se pone en rojo si queda más de {formatCents(rule.thresholdCents)} por debajo del objetivo. Caja inicial y umbral se cambian en Configuración; los objetivos acá.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Mes</TableHead><TableHead className="text-right">Caja del mes</TableHead><TableHead className="text-right">Caja real</TableHead><TableHead>Objetivo (USD)</TableHead><TableHead className="text-right">Diferencia</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
            <TableBody>
              {rule.rows.map((x) => (
                <TableRow key={x.monthIndex} className={x.month === month ? "bg-muted/40" : ""}>
                  <TableCell className="text-xs">M{x.monthIndex} · {monthLabel(x.month)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{x.status === "future" ? "—" : formatCents(x.flowCents)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{x.status === "future" ? "—" : formatCents(x.cashCents)}</TableCell>
                  <TableCell><TargetCell monthIndex={x.monthIndex} targetCents={x.targetCents} /></TableCell>
                  <TableCell className={`text-right font-mono text-xs ${x.status === "red" ? "text-destructive" : x.status === "warn" ? "text-oro-profundo" : ""}`}>{x.status === "future" ? "—" : formatCents(x.deltaCents)}</TableCell>
                  <TableCell>{badge(x.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className={`mt-6 ${metal.alert ? "border-oro" : ""}`}>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Precio del oro y valor a metal</CardTitle>
              <CardDescription>{metal.spot ? `Spot ${formatCents(metal.spot.usdPerOunceCents)}/oz (${metal.spot.source}, ${spotDate}) = ${formatCents(metal.spot.usdPerGramCents)}/g puro.` : "Sin spot cargado todavía: se actualiza solo cada día, o apretá el botón."}</CardDescription>
            </div>
            <GoldSpotButton />
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Oro puro en stock" value={`${metal.pureGrams.toFixed(2)} g`} hint={`${metal.grams.toFixed(2)} g de 14k`} />
          <Stat label="Valor a metal" value={metal.metalValueCents != null ? formatCents(metal.metalValueCents) : "—"} hint={`costo ${formatCents(metal.costCents)}`} />
          <Stat label="Spot por gramo de 14k" value={metal.spotPerGram14k != null ? `${formatCents(metal.spotPerGram14k)}/g` : "—"} hint={`compra configurada ${formatCents(metal.costPerGramDefault)}/g`} />
          <Stat label="Desvío vs costo de compra" value={metal.deviationPct != null ? `${metal.deviationPct > 0 ? "+" : ""}${metal.deviationPct}%` : "—"} hint={metal.alert ? "Revisá el costo por gramo de la próxima compra" : "dentro del rango"} className={metal.alert ? "border-oro" : ""} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Costo del inventario actual</CardTitle><CardDescription>Promedio ponderado por gramos en stock, contra {formatCents(s.precio_por_gramo)}/g de venta.</CardDescription></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Piezas" value={String(avg.pieces)} />
          <Stat label="Gramos" value={`${avg.grams.toFixed(2)} g`} />
          <Stat label="Costo promedio/g" value={avg.avgCentsPerGram ? `${formatCents(avg.avgCentsPerGram)}/g` : "—"} hint={`costo total ${formatCents(avg.costCents)}`} />
          <Stat label="Margen/g" value={avg.avgCentsPerGram ? `${formatCents(s.precio_por_gramo - avg.avgCentsPerGram)}/g` : "—"} />
        </CardContent>
      </Card>
    </>
  );
}
