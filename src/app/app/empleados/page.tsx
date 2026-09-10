import Link from "next/link";
import { CalculatorIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatCents } from "@/lib/money";
import { currentPeriod, photoUrl, previewPeriod, whoIsIn } from "@/lib/payroll/service";
import { entryHours } from "@/lib/payroll/calc";
import { addDaysKey, keyToUtc, nextPeriod, periodFor, periodLabel, prevPeriod } from "@/lib/payroll/periods";
import { EmployeeDialog } from "./employee-dialog";
import { EntryDialog, DeleteEntryButton } from "./entry-dialog";

export const metadata = { title: "Empleados" };
export const dynamic = "force-dynamic";

export default async function EmpleadosPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const s = await getSettings();
  const period = p && /^\d{4}-\d{2}-\d{2}$/.test(p) ? periodFor(p) : await currentPeriod();
  const from = keyToUtc(period.start);
  const to = keyToUtc(addDaysKey(period.end, 1));
  const [employees, inNow, entries, preview, closed] = await Promise.all([
    prisma.employee.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    whoIsIn(),
    prisma.timeEntry.findMany({ where: { clockIn: { gte: from, lt: to } }, include: { employee: true }, orderBy: { clockIn: "desc" } }),
    previewPeriod(period),
    prisma.payPeriod.findFirst({ where: { startsOn: from, status: { not: "open" } } }),
  ]);
  const tz = s.tienda_timezone;
  const fmtDate = new Intl.DateTimeFormat("es-US", { weekday: "short", day: "2-digit", month: "short", timeZone: tz });
  const fmtTime = new Intl.DateTimeFormat("es-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz });
  const localParts = (d: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
    const g = (t: string) => parts.find((x) => x.type === t)!.value;
    return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}` };
  };
  const rows = await Promise.all(entries.map(async (e) => ({ ...e, hours: entryHours(e), photoIn: await photoUrl(e.photoInPath), photoOut: await photoUrl(e.photoOutPath), local: localParts(e.clockIn), localOut: e.clockOut ? localParts(e.clockOut) : null })));
  const empOptions = employees.filter((e) => e.active).map((e) => ({ id: e.id, name: e.name }));

  return (
    <>
      <PageHeader
        eyebrow="Empleados"
        title="Empleados y fichaje"
        description={`La tablet de la tienda usa /kiosk con PIN. Zona horaria ${tz}.`}
        actions={<><Button asChild variant="outline"><Link href="/app/empleados/nomina"><CalculatorIcon /> Nómina</Link></Button><EmployeeDialog /></>}
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Fichadas ahora</CardTitle><CardDescription>Entradas abiertas.</CardDescription></CardHeader>
          <CardContent>
            {inNow.length === 0 ? <p className="text-sm text-muted-foreground">Nadie fichado.</p> : (
              <ul className="grid gap-1 text-sm">{inNow.map((e) => <li key={e.id} className="flex justify-between border-b py-1 last:border-0"><span>{e.employee.name}</span><span className="font-mono text-xs">desde {fmtTime.format(e.clockIn)} · {fmtDate.format(e.clockIn)}</span></li>)}</ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Equipo</CardTitle><CardDescription>PIN de 4 dígitos para la tablet, tarifa por hora.</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead className="text-right">$/h</TableHead><TableHead>Estado</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {employees.length === 0 && <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Agregá a las empleadas.</TableCell></TableRow>}
                {employees.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.name}{e.phone && <span className="block text-xs text-muted-foreground">{e.phone}</span>}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatCents(e.hourlyRateCents)}</TableCell>
                    <TableCell><Badge variant={e.active ? "success" : "outline"}>{e.active ? "activa" : "inactiva"}</Badge></TableCell>
                    <TableCell className="text-right"><EmployeeDialog employee={{ id: e.id, name: e.name, hourlyRate: (e.hourlyRateCents / 100).toFixed(2), hiredOn: e.hiredOn ? e.hiredOn.toISOString().slice(0, 10) : "", active: e.active, phone: e.phone ?? "", email: e.email ?? "", notes: e.notes ?? "", pin: "", shopifyStaffName: e.shopifyStaffName ?? "" }} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Entradas del período {periodLabel(period)} {closed && <Badge variant={closed.status === "paid" ? "success" : "gold"} className="ml-2">{closed.status === "paid" ? "pagado" : "cerrado"}</Badge>}</CardTitle>
              <CardDescription>Horas del período: {preview.lines.map((l) => `${l.name} ${l.regularHours + l.overtimeHours} h${l.overtimeHours ? ` (${l.overtimeHours} extra)` : ""}`).join(" · ") || "sin horas"}</CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button asChild size="sm" variant="ghost"><Link href={`/app/empleados?p=${prevPeriod(period).start}`}>← {periodLabel(prevPeriod(period))}</Link></Button>
              <Button asChild size="sm" variant="ghost"><Link href={`/app/empleados?p=${nextPeriod(period).start}`}>{periodLabel(nextPeriod(period))} →</Link></Button>
              {!closed && <EntryDialog employees={empOptions} />}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Empleada</TableHead><TableHead>Día</TableHead><TableHead>Entrada</TableHead><TableHead>Salida</TableHead><TableHead className="text-right">Descanso</TableHead><TableHead className="text-right">Horas</TableHead><TableHead>Nota</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Sin entradas en este período.</TableCell></TableRow>}
              {rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.employee.name}</TableCell>
                  <TableCell className="font-mono text-xs">{fmtDate.format(e.clockIn)}</TableCell>
                  <TableCell className="font-mono text-xs">{fmtTime.format(e.clockIn)}{e.photoIn && <a href={e.photoIn} target="_blank" rel="noreferrer" className="ml-1 text-oro-profundo">📷</a>}</TableCell>
                  <TableCell className="font-mono text-xs">{e.clockOut ? <>{fmtTime.format(e.clockOut)}{e.photoOut && <a href={e.photoOut} target="_blank" rel="noreferrer" className="ml-1 text-oro-profundo">📷</a>}</> : <Badge variant="gold">abierta</Badge>}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{e.breakMinutes} min</TableCell>
                  <TableCell className="text-right font-mono text-xs">{e.clockOut ? e.hours.toFixed(2) : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.editedBy && <span title="Corregida por un dueño">✎ </span>}{e.note ?? ""}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {!closed && <>
                      <EntryDialog employees={empOptions} entry={{ id: e.id, employeeId: e.employeeId, date: e.local.date, timeIn: e.local.time, timeOut: e.localOut?.time ?? "", breakMinutes: e.breakMinutes, note: e.note ?? "" }} />
                      <DeleteEntryButton id={e.id} />
                    </>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
