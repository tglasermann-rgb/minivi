"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { closePeriodAction, markPaidAction, reopenPeriodAction } from "../actions";
import type { Period } from "@/lib/payroll/periods";

export function PeriodActions({ period, closedId, status, openEntries }: { period: Period; closedId: string | null; status: "open" | "closed" | "paid"; openEntries: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) => start(async () => { const r = await fn(); if (r.ok) { toast.success(r.message ?? "Listo"); router.refresh(); } else toast.error(r.error ?? "Error"); });
  if (status === "open") return <Button variant="gold" size="sm" disabled={pending || openEntries > 0} title={openEntries ? "Hay entradas sin salida" : ""} onClick={() => { if (confirm(`¿Cerrar el período ${period.start} – ${period.end}? Se congelan las horas y el bruto.`)) run(() => closePeriodAction(period.start, period.end)); }}>Cerrar período</Button>;
  if (status === "closed") return <>
    <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => reopenPeriodAction(closedId!))}>Reabrir</Button>
    <Button variant="gold" size="sm" disabled={pending} onClick={() => { if (confirm("¿Marcar como pagado? No se puede reabrir después.")) run(() => markPaidAction(closedId!)); }}>Marcar pagado</Button>
  </>;
  return null;
}
