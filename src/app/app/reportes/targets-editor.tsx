"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { setCashTargetAction } from "./actions";

export function TargetCell({ monthIndex, targetCents }: { monthIndex: number; targetCents: number }) {
  const router = useRouter();
  const [v, setV] = useState((targetCents / 100).toFixed(0));
  const [pending, start] = useTransition();
  const save = () => start(async () => { const r = await setCashTargetAction(monthIndex, Number(v)); if (r.ok) router.refresh(); else toast.error(r.error); });
  return (
    <span className="inline-flex items-center gap-1">
      <Input type="number" step="1" className="h-7 w-28 font-mono text-xs" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={pending} onClick={save}>ok</Button>
    </span>
  );
}
