"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatCents } from "@/lib/money";
import { setMonthOverrideAction } from "../actions";

export function MonthCell({ categoryId, month, spentCents, budgetCents, overridden }: { categoryId: string; month: string; spentCents: number; budgetCents: number; overridden: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState((budgetCents / 100).toFixed(2));
  const [pending, start] = useTransition();
  const save = (amount: number | null) => start(async () => {
    const r = await setMonthOverrideAction(categoryId, month, amount);
    if (r.ok) { setEditing(false); router.refresh(); } else toast.error(r.error);
  });
  const over = budgetCents > 0 && spentCents > budgetCents;
  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input autoFocus type="number" step="0.01" className="w-24 rounded border px-1 font-mono text-xs" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(Number(val)); if (e.key === "Escape") setEditing(false); }} />
        <button className="text-xs text-oro-profundo" disabled={pending} onClick={() => save(Number(val))}>ok</button>
        {overridden && <button className="text-xs text-muted-foreground" disabled={pending} onClick={() => save(null)}>reset</button>}
      </span>
    );
  }
  return (
    <span className="font-mono text-xs">
      <span className={over ? "text-destructive" : spentCents ? "" : "text-muted-foreground"}>{formatCents(spentCents)}</span>
      <button className={`ml-1 text-muted-foreground hover:text-foreground hover:underline ${overridden ? "text-oro-profundo" : ""}`} title="Cambiar presupuesto de este mes" onClick={() => setEditing(true)}>/ {formatCents(budgetCents)}</button>
    </span>
  );
}
