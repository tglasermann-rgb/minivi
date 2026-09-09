import Link from "next/link";
import { ArrowLeftIcon, DownloadIcon, FileTextIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Stat } from "@/components/ui/stat";
import { formatCents } from "@/lib/money";
import { currentPeriod, listPeriods, payrollByMonth, previewPeriod } from "@/lib/payroll/service";
import { nextPeriod, periodFor, periodLabel, prevPeriod, utcToKey } from "@/lib/payroll/periods";
import { addMonths, monthLabel, yearMonthOf } from "@/lib/expenses/budget";
import { getSettings } from "@/lib/settings";
import { PeriodActions } from "./period-actions";

export const metadata = { title: "Nómina" };
export const dynamic = "force-dynamic";

export default async function NominaPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const s = await getSettings();
  const period = p && /^\d{4}-\d{2}-\d{2}$/.test(p) ? periodFor(p) : prevPeriod(await currentPeriod());
  const [preview, periods] = await Promise.all([previewPeriod(period), listPeriods()]);
  const closed = periods.find((x) => utcToKey(x.startsOn) === period.start);
  const thisMonth = yearMonthOf(new Date(), s.tienda_timezone);
  const months = Array.from({ length: 6 }, (_, i) => addMonths(thisMonth, i - 5));
  const byMonth = await payrollByMonth(months);

  return (
    <>
      <div className="mb-2"><Link href="/app/empleados" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" /> Empleados</Link></div>
      <PageHeader eyebrow="Nómina" title={`Período ${periodLabel(period)} (${period.start.slice(0, 4)})`} description="Horas normales y extra (1.5× sobre 40 h por semana). Bruto sin retenciones: el pago lo hace el proveedor de nómina." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href={`/app/empleados/nomina?p=${prevPeriod(period).start}`}>← anterior</Link></Button>
        <Button asChild size="sm" variant="ghost"><Link href={`/app/empleados/nomina?p=${nextPeriod(period).start}`}>siguiente →</Link></Button>
        <span className="text-sm text-muted-foreground">Estado: {closed ? <Badge variant={closed.status === "paid" ? "success" : "gold"}>{closed.status === "paid" ? "pagado" : "cerrado"}</Badge> : <Badge variant="secondary">abierto</Badge>}</span>
        <div className="ml-auto flex gap-2">
          {closed && <>
            <Button asChild variant="outline" size="sm"><a href={`/api/nomina?id=${closed.id}&format=pdf`} target="_blank" rel="noreferrer"><FileTextIcon /> PDF</a></Button>
            <Button asChild variant="outline" size="sm"><a href={`/api/nomina?id=${closed.id}&format=csv`}><DownloadIcon /> CSV para payroll</a></Button>
          </>}
          <PeriodActions period={period} closedId={closed?.id ?? null} status={closed?.status ?? "open"} openEntries={preview.openEntries} />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Bruto del período" value={formatCents(preview.totalGrossCents)} />
        <Stat label="Horas normales" value={preview.lines.reduce((a, l) => a + l.regularHours, 0).toFixed(2)} />
        <Stat label="Horas extra" value={preview.lines.reduce((a, l) => a + l.overtimeHours, 0).toFixed(2)} />
        <Stat label="Entradas sin salida" value={String(preview.openEntries)} className={preview.openEntries ? "border-destructive/50" : ""} hint={preview.openEntries ? "corregir antes de cerrar" : undefined} />
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Resumen por empleada</CardTitle><CardDescription>{closed ? "Valores congelados al cerrar." : "Cálculo en vivo con las entradas actuales."}</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Empleada</TableHead><TableHead className="text-right">Normales</TableHead><TableHead className="text-right">Extra</TableHead><TableHead className="text-right">Tarifa</TableHead><TableHead className="text-right">Bruto</TableHead></TableRow></TableHeader>
            <TableBody>
              {preview.lines.map((l) => (
                <TableRow key={l.employeeId}>
                  <TableCell>{l.name}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{l.regularHours.toFixed(2)}</TableCell>
                  <TableCell className={`text-right font-mono text-xs ${l.overtimeHours ? "text-oro-profundo" : ""}`}>{l.overtimeHours.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatCents(l.rateCents)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCents(l.grossCents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Períodos cerrados</CardTitle></CardHeader>
          <CardContent>
            {periods.length === 0 ? <p className="text-sm text-muted-foreground">Ninguno todavía.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Período</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Bruto</TableHead></TableRow></TableHeader>
                <TableBody>
                  {periods.map((x) => (
                    <TableRow key={x.id}>
                      <TableCell className="font-mono text-xs"><Link href={`/app/empleados/nomina?p=${utcToKey(x.startsOn)}`} className="text-oro-profundo hover:underline">{utcToKey(x.startsOn)} – {utcToKey(x.endsOn)}</Link></TableCell>
                      <TableCell><Badge variant={x.status === "paid" ? "success" : x.status === "closed" ? "gold" : "secondary"}>{x.status === "paid" ? "pagado" : x.status === "closed" ? "cerrado" : "abierto"}</Badge></TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatCents(x.lines.reduce((a, l) => a + l.grossCents, 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Nómina por mes vs. plan</CardTitle><CardDescription>Períodos cerrados. Presupuesto: categoría &quot;Nómina&quot; (7,767/mes del plan).</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Mes</TableHead><TableHead className="text-right">Bruto</TableHead><TableHead className="text-right">Plan</TableHead><TableHead className="text-right">Dif.</TableHead></TableRow></TableHeader>
              <TableBody>
                {byMonth.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell className="text-xs">{monthLabel(m.month)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatCents(m.grossCents)}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatCents(m.budgetCents)}</TableCell>
                    <TableCell className={`text-right font-mono text-xs ${m.grossCents > m.budgetCents ? "text-destructive" : "text-emerald-700"}`}>{formatCents(m.budgetCents - m.grossCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
