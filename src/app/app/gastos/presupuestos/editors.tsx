"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { setCategoryBudgetAction, setOpeningBudgetAction } from "../actions";

type Item = { id: string; name: string; amountCents: number; laterCents: number | null };

export function BudgetEditors({ kind, items }: { kind: "opening" | "monthly"; items: Item[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [vals, setVals] = useState<Record<string, { a: string; l: string }>>(() => Object.fromEntries(items.map((i) => [i.id, { a: (i.amountCents / 100).toFixed(2), l: i.laterCents != null ? (i.laterCents / 100).toFixed(2) : "" }])));
  const save = (i: Item) => start(async () => {
    const v = vals[i.id];
    const r = kind === "opening" ? await setOpeningBudgetAction(i.id, Number(v.a)) : await setCategoryBudgetAction(i.id, Number(v.a), v.l === "" ? null : Number(v.l));
    if (r.ok) { toast.success(r.message ?? "Guardado"); router.refresh(); } else toast.error(r.error);
  });
  return (
    <div className="grid gap-2">
      {kind === "monthly" && <div className="grid grid-cols-[1fr_110px_110px_60px] gap-2 text-[11px] uppercase tracking-wide text-muted-foreground"><span /><span>Mensual</span><span>Desde mes 7</span><span /></div>}
      {items.map((i) => (
        <div key={i.id} className={`grid items-center gap-2 ${kind === "monthly" ? "grid-cols-[1fr_110px_110px_60px]" : "grid-cols-[1fr_130px_60px]"}`}>
          <span className="text-sm">{i.name}</span>
          <Input type="number" step="0.01" min="0" className="font-mono" value={vals[i.id].a} onChange={(e) => setVals({ ...vals, [i.id]: { ...vals[i.id], a: e.target.value } })} />
          {kind === "monthly" && <Input type="number" step="0.01" min="0" placeholder="igual" className="font-mono" value={vals[i.id].l} onChange={(e) => setVals({ ...vals, [i.id]: { ...vals[i.id], l: e.target.value } })} />}
          <Button size="sm" variant="outline" disabled={pending} onClick={() => save(i)}>Guardar</Button>
        </div>
      ))}
    </div>
  );
}
