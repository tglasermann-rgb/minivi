"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { retryWebhooksAction, syncOrdersAction } from "./actions";

export function SyncButton({ failedWebhooks }: { failedWebhooks: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (label: string, fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) => start(async () => {
    const t = toast.loading(label); const r = await fn(); toast.dismiss(t);
    if (r.ok) { toast.success(r.message ?? "Listo"); router.refresh(); } else toast.error(r.error ?? "Error");
  });
  return (
    <>
      {failedWebhooks > 0 && <Button variant="outline" size="sm" disabled={pending} onClick={() => run("Reprocesando…", retryWebhooksAction)}>Reintentar {failedWebhooks} webhook(s)</Button>}
      <Button variant="outline" disabled={pending} onClick={() => run("Sincronizando con Shopify…", () => syncOrdersAction(false))}><RefreshCwIcon className={pending ? "animate-spin" : ""} /> Sincronizar</Button>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => { if (confirm("¿Traer TODAS las órdenes históricas de Shopify? Puede tardar.")) run("Sincronización completa…", () => syncOrdersAction(true)); }}>Todo el historial</Button>
    </>
  );
}
