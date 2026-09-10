"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PaperclipIcon, PencilIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCents } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/expenses/labels";
import { reimburseAction } from "./actions";
import { EditExpenseForm, type Cat, type ExpenseDefaults } from "./quick-form";
import type { PaymentMethod } from "@/generated/prisma/client";

export type ExpenseRow = {
  id: string; date: string; category: string; categoryId: string; group: "opening" | "recurring"; vendor: string; amountCents: number; paymentMethod: PaymentMethod;
  recurring: boolean; frequency: string | null; notes: string; paid: boolean; reimbursable: boolean; reimbursedOn: string | null; receiptUrl: string | null;
};
const dateFmt = new Intl.DateTimeFormat("es-US", { day: "2-digit", month: "short", timeZone: "UTC" });

export function ExpenseList({ rows, categories }: { rows: ExpenseRow[]; categories: Cat[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const reimburse = (id: string, on: string | null) => start(async () => { const r = await reimburseAction(id, on); if (r.ok) { toast.success(r.message ?? "Listo"); router.refresh(); } else toast.error(r.error); });

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Proveedor</TableHead><TableHead>Categoría</TableHead><TableHead>Pago</TableHead><TableHead className="text-right">Monto</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Sin gastos este mes.</TableCell></TableRow>}
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs">{dateFmt.format(new Date(`${r.date}T00:00:00Z`))}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  {r.receiptUrl && <a href={r.receiptUrl} target="_blank" rel="noreferrer" title="Ver comprobante" className="text-oro-profundo"><PaperclipIcon className="size-3.5" /></a>}
                  <span>{r.vendor}</span>
                  {r.recurring && <Badge variant="secondary">{r.frequency === "yearly" ? "anual" : "mensual"}</Badge>}
                  {!r.paid && <Badge variant="destructive">sin pagar</Badge>}
                </div>
                {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
              </TableCell>
              <TableCell className="text-xs">{r.category}{r.group === "opening" && <span className="text-muted-foreground"> · apertura</span>}</TableCell>
              <TableCell className="text-xs">
                {PAYMENT_METHOD_LABELS[r.paymentMethod]}
                {r.reimbursable && (
                  r.reimbursedOn
                    ? <button className="ml-1 text-emerald-700 hover:underline" disabled={pending} onClick={() => reimburse(r.id, null)}>reembolsado</button>
                    : <button className="ml-1 text-oro-profundo hover:underline" disabled={pending} onClick={() => reimburse(r.id, new Date().toISOString().slice(0, 10))}>marcar reembolsado</button>
                )}
              </TableCell>
              <TableCell className="text-right font-mono">{formatCents(r.amountCents)}</TableCell>
              <TableCell className="text-right"><Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setEditing(r)}><PencilIcon /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar gasto</DialogTitle></DialogHeader>
          {editing && (
            <EditExpenseForm
              categories={categories}
              onDone={() => setEditing(null)}
              initial={{ id: editing.id, date: editing.date, categoryId: editing.categoryId, vendor: editing.vendor, amount: (editing.amountCents / 100).toFixed(2), paymentMethod: editing.paymentMethod, recurring: editing.recurring, frequency: editing.frequency ?? "monthly", notes: editing.notes, paid: editing.paid, reimbursable: editing.reimbursable } satisfies ExpenseDefaults}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
