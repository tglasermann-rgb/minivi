"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CameraIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PAYMENT_METHOD_LABELS } from "@/lib/expenses/labels";
import { createExpenseAction, updateExpenseAction } from "./actions";

export type Cat = { id: string; name: string; group: "opening" | "recurring" };
const selectCls = "h-10 w-full rounded-md border border-input bg-card px-2 text-base md:text-sm";

export type ExpenseDefaults = {
  id?: string; date: string; categoryId: string; vendor: string; amount: string; paymentMethod: string; recurring: boolean; frequency: string; notes: string; paid: boolean; reimbursable: boolean;
};

export function ExpenseFields({ categories, d, onChange }: { categories: Cat[]; d: ExpenseDefaults; onChange: (n: ExpenseDefaults) => void }) {
  const rec = categories.filter((c) => c.group === "recurring");
  const op = categories.filter((c) => c.group === "opening");
  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <Label htmlFor="receipt">Foto de la factura</Label>
        <Input id="receipt" name="receipt" type="file" accept="image/*,.pdf" capture="environment" className="h-10" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1"><Label htmlFor="date">Fecha</Label><Input id="date" name="date" type="date" className="h-10 font-mono" value={d.date} onChange={(e) => onChange({ ...d, date: e.target.value })} required /></div>
        <div className="grid gap-1"><Label htmlFor="amount">Monto (USD)</Label><Input id="amount" name="amount" type="number" step="0.01" min="0" inputMode="decimal" className="h-10 font-mono text-lg" value={d.amount} onChange={(e) => onChange({ ...d, amount: e.target.value })} required /></div>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="categoryId">Categoría</Label>
        <select id="categoryId" name="categoryId" className={selectCls} value={d.categoryId} onChange={(e) => onChange({ ...d, categoryId: e.target.value })} required>
          <option value="">Elegí…</option>
          <optgroup label="Recurrentes">{rec.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
          <optgroup label="Apertura (una sola vez)">{op.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
        </select>
      </div>
      <div className="grid gap-1"><Label htmlFor="vendor">Proveedor / comercio</Label><Input id="vendor" name="vendor" className="h-10" value={d.vendor} onChange={(e) => onChange({ ...d, vendor: e.target.value })} required /></div>
      <div className="grid gap-1">
        <Label htmlFor="paymentMethod">Método de pago</Label>
        <select id="paymentMethod" name="paymentMethod" className={selectCls} value={d.paymentMethod} onChange={(e) => onChange({ ...d, paymentMethod: e.target.value, reimbursable: e.target.value.startsWith("personal_card") || d.reimbursable })}>
          {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="recurring" checked={d.recurring} onChange={(e) => onChange({ ...d, recurring: e.target.checked })} /> Recurrente</label>
        {d.recurring && (
          <select name="frequency" className={selectCls} value={d.frequency} onChange={(e) => onChange({ ...d, frequency: e.target.value })}>
            <option value="monthly">Mensual</option><option value="yearly">Anual</option>
          </select>
        )}
        <label className="flex items-center gap-2"><input type="checkbox" name="paid" checked={d.paid} onChange={(e) => onChange({ ...d, paid: e.target.checked })} /> Pagado</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="reimbursable" checked={d.reimbursable} onChange={(e) => onChange({ ...d, reimbursable: e.target.checked })} /> Reembolsable</label>
      </div>
      <div className="grid gap-1"><Label htmlFor="notes">Notas</Label><Textarea id="notes" name="notes" rows={2} value={d.notes} onChange={(e) => onChange({ ...d, notes: e.target.value })} /></div>
    </div>
  );
}

export function QuickExpenseForm({ categories, today }: { categories: Cat[]; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const empty: ExpenseDefaults = { date: today, categoryId: "", vendor: "", amount: "", paymentMethod: "company_card", recurring: false, frequency: "monthly", notes: "", paid: true, reimbursable: false };
  const [d, setD] = useState<ExpenseDefaults>(empty);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CameraIcon className="size-5 text-oro" /> Cargar gasto</CardTitle>
        <CardDescription>Foto, fecha, monto, categoría. Listo.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const r = await createExpenseAction(fd);
              if (r.ok) { toast.success(r.message ?? "Listo"); setD({ ...empty, date: d.date }); formRef.current?.reset(); router.refresh(); }
              else toast.error(r.error + (r.fieldErrors ? ": " + Object.entries(r.fieldErrors).map(([k, v]) => `${k} ${v?.[0]}`).join(", ") : ""));
            });
          }}
          className="grid gap-3"
        >
          <ExpenseFields categories={categories} d={d} onChange={setD} />
          <Button type="submit" variant="gold" size="lg" disabled={pending}>{pending ? "Guardando…" : "Guardar gasto"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function EditExpenseForm({ categories, initial, onDone }: { categories: Cat[]; initial: ExpenseDefaults; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [d, setD] = useState<ExpenseDefaults>(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await updateExpenseAction(initial.id!, fd);
          if (r.ok) { toast.success(r.message ?? "Listo"); onDone(); router.refresh(); } else toast.error(r.error);
        });
      }}
      className="grid gap-3"
    >
      <ExpenseFields categories={categories} d={d} onChange={setD} />
      <Button type="submit" variant="gold" disabled={pending}>{pending ? "Guardando…" : "Guardar cambios"}</Button>
    </form>
  );
}
