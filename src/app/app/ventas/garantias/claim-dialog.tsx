"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { saveClaimAction, type ClaimInput } from "./actions";

type C = ClaimInput & { id?: string };
const selectCls = "h-9 w-full rounded-md border border-input bg-card px-2 text-sm";

export function ClaimDialog({ claim }: { claim?: C }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [v, setV] = useState<C>(claim ?? { sku: "", orderNumber: "", customerName: "", customerContact: "", soldOn: "", reportedOn: new Date().toISOString().slice(0, 10), issue: "", resolution: "", cost: 0, status: "open", notes: "" });
  const set = (k: keyof C) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  const save = () => start(async () => { const r = await saveClaimAction(claim?.id ?? null, v); if (r.ok) { toast.success(r.message); setOpen(false); router.refresh(); } else toast.error(r.error); });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{claim ? <Button size="sm" variant="ghost">Editar</Button> : <Button variant="gold"><PlusIcon /> Nuevo reclamo</Button>}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{claim ? "Editar reclamo" : "Nuevo reclamo de garantía"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>SKU</Label><Input className="font-mono uppercase" value={v.sku} onChange={set("sku")} /></div>
            <div className="grid gap-1"><Label>Nº de orden (Shopify)</Label><Input className="font-mono" value={v.orderNumber ?? ""} onChange={set("orderNumber")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Cliente</Label><Input value={v.customerName ?? ""} onChange={set("customerName")} /></div>
            <div className="grid gap-1"><Label>Contacto</Label><Input value={v.customerContact ?? ""} onChange={set("customerContact")} placeholder="teléfono o email" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Fecha de venta</Label><Input type="date" className="font-mono" value={v.soldOn ?? ""} onChange={set("soldOn")} /></div>
            <div className="grid gap-1"><Label>Fecha del reclamo</Label><Input type="date" className="font-mono" value={v.reportedOn} onChange={set("reportedOn")} /></div>
          </div>
          <div className="grid gap-1"><Label>Qué pasó</Label><Textarea rows={2} value={v.issue} onChange={set("issue")} /></div>
          <div className="grid gap-1"><Label>Resolución</Label><Textarea rows={2} value={v.resolution ?? ""} onChange={set("resolution")} placeholder="cambio por pieza nueva, reparación con joyero externo, reembolso…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Costo para MiniVi (USD)</Label><Input type="number" step="0.01" min="0" className="font-mono" value={String(v.cost ?? 0)} onChange={set("cost")} /></div>
            <div className="grid gap-1"><Label>Estado</Label><select className={selectCls} value={v.status ?? "open"} onChange={set("status")}><option value="open">Abierta</option><option value="resolved">Resuelta</option></select></div>
          </div>
          <div className="grid gap-1"><Label>Notas</Label><Textarea rows={2} value={v.notes ?? ""} onChange={set("notes")} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="gold" disabled={pending} onClick={save}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
