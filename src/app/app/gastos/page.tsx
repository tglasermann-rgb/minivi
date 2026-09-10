import Link from "next/link";
import { CalendarRangeIcon, DownloadIcon, LandmarkIcon, SlidersHorizontalIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/ui/stat";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { expectedRecurring, listCategories, listExpensesByMonth, receiptUrl } from "@/lib/expenses/service";
import { addMonths, monthLabel, yearMonthOf } from "@/lib/expenses/budget";
import { QuickExpenseForm } from "./quick-form";
import { ExpenseList } from "./expense-list";

export const metadata = { title: "Gastos" };
export const dynamic = "force-dynamic";

export default async function GastosPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const s = await getSettings();
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : yearMonthOf(new Date(), s.tienda_timezone);
  const [cats, expenses, expected] = await Promise.all([listCategories(), listExpensesByMonth(month), expectedRecurring(month)]);
  const rows = await Promise.all(expenses.map(async (e) => ({
    id: e.id, date: e.date.toISOString().slice(0, 10), category: e.category.name, categoryId: e.categoryId, group: e.category.group, vendor: e.vendor, amountCents: e.amountCents,
    paymentMethod: e.paymentMethod, recurring: e.recurring, frequency: e.frequency, notes: e.notes ?? "", paid: e.paid, reimbursable: e.reimbursable,
    reimbursedOn: e.reimbursedOn ? e.reimbursedOn.toISOString().slice(0, 10) : null, receiptUrl: await receiptUrl(e.receiptPath),
  })));
  const total = rows.reduce((s, r) => s + r.amountCents, 0);
  const reimb = rows.filter((r) => r.reimbursable && !r.reimbursedOn).reduce((s, r) => s + r.amountCents, 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        eyebrow="Gastos"
        title={`Gastos de ${monthLabel(month)}`}
        description="Cargá con foto desde el celular. Lo pagado con tarjeta personal queda marcado como reembolsable."
        actions={
          <>
            <Button asChild variant="outline"><Link href="/app/gastos/apertura"><LandmarkIcon /> Apertura</Link></Button>
            <Button asChild variant="outline"><Link href="/app/gastos/mensual"><CalendarRangeIcon /> Mensual</Link></Button>
            <Button asChild variant="outline"><Link href="/app/gastos/presupuestos"><SlidersHorizontalIcon /> Presupuestos</Link></Button>
            <Button asChild variant="outline"><a href={`/api/gastos?from=${month}-01&to=${addMonths(month, 1)}-01`}><DownloadIcon /> CSV contador</a></Button>
          </>
        }
      />
      <div className="mb-4 flex items-center gap-2 text-sm">
        <Button asChild size="sm" variant="ghost"><Link href={`/app/gastos?m=${addMonths(month, -1)}`}>← {monthLabel(addMonths(month, -1))}</Link></Button>
        <span className="font-medium">{monthLabel(month)}</span>
        <Button asChild size="sm" variant="ghost"><Link href={`/app/gastos?m=${addMonths(month, 1)}`}>{monthLabel(addMonths(month, 1))} →</Link></Button>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total del mes" value={formatCents(total)} hint={`${rows.length} gasto(s)`} />
        <Stat label="Reembolsable pendiente" value={formatCents(reimb)} className={reimb > 0 ? "border-oro/60" : ""} />
        <Stat label="Apertura" value={formatCents(rows.filter((r) => r.group === "opening").reduce((s, r) => s + r.amountCents, 0))} />
        <Stat label="Recurrentes" value={formatCents(rows.filter((r) => r.group === "recurring").reduce((s, r) => s + r.amountCents, 0))} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="grid gap-4 self-start">
          <QuickExpenseForm categories={cats.map((c) => ({ id: c.id, name: c.name, group: c.group }))} today={today} />
          {expected.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Recurrentes que faltan este mes</CardTitle><CardDescription>Se cargaron en meses anteriores como recurrentes y todavía no aparecen.</CardDescription></CardHeader>
              <CardContent>
                <ul className="grid gap-1 text-sm">
                  {expected.map((x) => <li key={`${x.categoryId}-${x.vendor}`} className="flex justify-between border-b py-1 last:border-0"><span>{x.vendor} <span className="text-muted-foreground">· {x.category}</span></span><span className="font-mono text-xs">{formatCents(x.amountCents)}</span></li>)}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
        <ExpenseList rows={rows} categories={cats.map((c) => ({ id: c.id, name: c.name, group: c.group }))} />
      </div>
    </>
  );
}
