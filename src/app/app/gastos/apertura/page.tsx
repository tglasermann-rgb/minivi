import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Stat } from "@/components/ui/stat";
import { Card, CardContent } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { openingSummary } from "@/lib/expenses/service";

export const metadata = { title: "Apertura" };
export const dynamic = "force-dynamic";

export default async function AperturaPage() {
  const { rows, totalBudget, totalSpent } = await openingSummary();
  return (
    <>
      <div className="mb-2"><Link href="/app/gastos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" /> Gastos</Link></div>
      <PageHeader eyebrow="Gastos" title="Apertura: gastado vs. plan" description="Gastos de una sola vez contra el presupuesto del plan de negocio. Inventario = compras (no borradores)." />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Presupuesto de apertura" value={formatCents(totalBudget)} />
        <Stat label="Gastado" value={formatCents(totalSpent)} hint={totalBudget ? `${Math.round((totalSpent / totalBudget) * 100)}% del plan` : undefined} />
        <Stat label="Disponible" value={formatCents(totalBudget - totalSpent)} className={totalSpent > totalBudget ? "border-destructive/50" : ""} />
      </div>
      <Card>
        <CardContent className="grid gap-4 pt-1">
          {rows.map((r) => {
            const pct = r.budgetCents ? Math.min(100, Math.round((r.spentCents / r.budgetCents) * 100)) : 0;
            const over = r.spentCents > r.budgetCents;
            return (
              <div key={r.group}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{r.group}</span>
                  <span className="font-mono text-xs"><span className={over ? "text-destructive" : ""}>{formatCents(r.spentCents)}</span> <span className="text-muted-foreground">/ {formatCents(r.budgetCents)}</span></span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full ${over ? "bg-destructive" : "bg-oro"}`} style={{ width: `${pct}%` }} /></div>
                {r.categories.length > 1 && (
                  <p className="mt-1 text-xs text-muted-foreground">{r.categories.map((c) => `${c.name}: ${formatCents(c.spentCents)}`).join(" · ")}</p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}
