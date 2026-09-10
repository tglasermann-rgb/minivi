"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { refreshGoldSpotAction } from "@/app/app/configuracion/actions";

export function GoldSpotButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (manual?: number) => start(async () => { const r = await refreshGoldSpotAction(manual); if (r.ok) { toast.success(r.message ?? "Listo"); router.refresh(); } else toast.error(r.error); });
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run()}>Actualizar spot</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => { const v = prompt("Precio del oro en USD por onza troy:"); if (v && Number(v) > 0) run(Number(v)); }}>Cargar a mano</Button>
    </div>
  );
}
