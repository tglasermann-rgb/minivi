import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { monthLabel } from "@/lib/expenses/budget";
import { BudgetEditors } from "./editors";

export const metadata = { title: "Presupuestos" };
export const dynamic = "force-dynamic";

export default async function PresupuestosPage() {
  const [opening, cats, s] = await Promise.all([
    prisma.openingBudget.findMany({ orderBy: { amountCents: "desc" } }),
    prisma.expenseCategory.findMany({ where: { group: "recurring" }, orderBy: { sort: "asc" } }),
    getSettings(),
  ]);
  return (
    <>
      <div className="mb-2"><Link href="/app/gastos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" /> Gastos</Link></div>
      <PageHeader eyebrow="Gastos" title="Presupuestos del plan" description={`Mes de apertura configurado: ${monthLabel(s.apertura_mes)} (se cambia en Configuración).`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Apertura (una sola vez)</CardTitle><CardDescription>Presupuesto por grupo. <CardDescription>Presupuesto por grupo. "Inventario" se compara contra las compras.</CardDescription>quot;Inventario<CardDescription>Presupuesto por grupo. "Inventario" se compara contra las compras.</CardDescription>quot; se compara contra las compras.</CardDescription></CardHeader>
          <CardContent><BudgetEditors kind="opening" items={opening.map((o) => ({ id: o.group, name: o.group, amountCents: o.amountCents, laterCents: null }))} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recurrentes (por mes)</CardTitle><CardDescription>Renta 2,400, nómina 7,767 y marketing 2,500 → 4,500 desde el mes 7 vienen del plan. El resto se completa acá.</CardDescription></CardHeader>
          <CardContent><BudgetEditors kind="monthly" items={cats.map((c) => ({ id: c.id, name: c.name, amountCents: c.monthlyBudgetCents, laterCents: c.monthlyBudgetLaterCents }))} /></CardContent>
        </Card>
      </div>
    </>
  );
}
