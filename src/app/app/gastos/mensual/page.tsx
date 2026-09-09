import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCents } from "@/lib/money";
import { monthlyMatrix } from "@/lib/expenses/service";
import { monthLabel, planMonthIndex } from "@/lib/expenses/budget";
import { MonthCell } from "./month-cell";

export const metadata = { title: "Gastos mensuales" };
export const dynamic = "force-dynamic";

export default async function MensualPage() {
  const { months, rows, totals, openingMonth } = await monthlyMatrix(6);
  return (
    <>
      <div className="mb-2"><Link href="/app/gastos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" /> Gastos</Link></div>
      <PageHeader eyebrow="Gastos" title="Mensual: gastado vs. presupuesto" description={`Cada celda: gastado / presupuesto. Mes de apertura: ${monthLabel(openingMonth)} (mes 1 del plan). Hacé clic en un presupuesto para cambiarlo solo ese mes.`} />
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoría</TableHead>
              {months.map((m) => { const idx = planMonthIndex(m, openingMonth); return <TableHead key={m} className="text-right">{monthLabel(m)}{idx > 0 && <span className="ml-1 text-[10px] text-oro-profundo">M{idx}</span>}</TableHead>; })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.categoryId}>
                <TableCell className="text-sm">{r.name}</TableCell>
                {r.cells.map((c) => <TableCell key={c.month} className="text-right"><MonthCell categoryId={r.categoryId} month={c.month} spentCents={c.spentCents} budgetCents={c.budgetCents} overridden={c.overridden} /></TableCell>)}
              </TableRow>
            ))}
            <TableRow className="bg-muted/40 font-medium">
              <TableCell>Total</TableCell>
              {totals.map((t) => <TableCell key={t.month} className="text-right font-mono text-xs"><span className={t.spentCents > t.budgetCents ? "text-destructive" : ""}>{formatCents(t.spentCents)}</span><span className="text-muted-foreground"> / {formatCents(t.budgetCents)}</span></TableCell>)}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </>
  );
}
