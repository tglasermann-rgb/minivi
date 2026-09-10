import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { weeklyUnits } from "@/lib/sales/stats";

const fmt = new Intl.DateTimeFormat("es-US", { day: "2-digit", month: "short", timeZone: "America/New_York" });

/** La métrica central del plan: unidades vendidas por semana contra los escenarios y umbrales. */
export async function WeeklyMetric({ compact = false }: { compact?: boolean }) {
  const { weeks, thresholds } = await weeklyUnits(compact ? 6 : 10);
  const current = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];
  const max = Math.max(thresholds.optimista, ...weeks.map((w) => w.units)) * 1.1;
  const pct = (n: number) => `${Math.min(100, (n / max) * 100)}%`;
  const status = current.units >= thresholds.base ? "ok" : current.units >= thresholds.cubreGastosYBanco ? "warn" : "bad";
  const color = status === "ok" ? "text-emerald-700" : status === "warn" ? "text-oro-profundo" : "text-destructive";
  const marks = [
    { label: `cubre gastos ${thresholds.cubreGastos}`, v: thresholds.cubreGastos, cls: "border-destructive/60" },
    { label: `gastos + banco ${thresholds.cubreGastosYBanco}`, v: thresholds.cubreGastosYBanco, cls: "border-oro" },
    { label: `base ${thresholds.base}`, v: thresholds.base, cls: "border-tinta" },
    { label: `optimista ${thresholds.optimista}`, v: thresholds.optimista, cls: "border-emerald-600" },
  ];

  return (
    <Card className="border-oro/50">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-baseline gap-x-3">
          <span>Ventas por semana</span>
          <span className={`font-mono text-4xl ${color}`}>{current.units}</span>
          <span className="text-sm font-normal text-muted-foreground">piezas esta semana · {formatCents(current.netCents)} · {current.orders} orden(es)</span>
        </CardTitle>
        <CardDescription>
          Plan: base {thresholds.base} · conservador {thresholds.conservador} · optimista {thresholds.optimista}. Umbrales: {thresholds.cubreGastos} cubre gastos, {thresholds.cubreGastosYBanco} cubre gastos y banco.
          {prev && <> Semana pasada: {prev.units}.</>} {!compact && <Link href="/app/ventas" className="text-oro-profundo hover:underline">Ver ventas</Link>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="grid gap-1.5">
            {weeks.map((w, i) => {
              const last = i === weeks.length - 1;
              return (
                <div key={w.start.toISOString()} className="grid grid-cols-[92px_1fr_40px] items-center gap-2 text-xs">
                  <span className={`font-mono ${last ? "text-foreground" : "text-muted-foreground"}`}>{fmt.format(w.start)}{last ? " ←" : ""}</span>
                  <div className="relative h-4 rounded bg-muted">
                    <div className={`h-full rounded ${w.units >= thresholds.base ? "bg-emerald-600" : w.units >= thresholds.cubreGastosYBanco ? "bg-oro" : "bg-destructive/70"}`} style={{ width: pct(w.units) }} />
                    {last && marks.map((m) => <span key={m.label} title={m.label} className={`absolute top-0 h-full border-l-2 border-dashed ${m.cls}`} style={{ left: pct(m.v) }} />)}
                  </div>
                  <span className="text-right font-mono">{w.units}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            {marks.map((m) => <span key={m.label} className="flex items-center gap-1"><span className={`inline-block h-3 border-l-2 border-dashed ${m.cls}`} /> {m.label}</span>)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
