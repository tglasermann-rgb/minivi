"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { saveSupplierAction } from "../actions";

type S = { id: string; name: string; contact: string; paymentTerms: string; notes: string; active: boolean };

export function SupplierDialog({ supplier }: { supplier?: S }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [v, setV] = useState<Omit<S, "id">>({ name: supplier?.name ?? "", contact: supplier?.contact ?? "", paymentTerms: supplier?.paymentTerms ?? "", notes: supplier?.notes ?? "", active: supplier?.active ?? true });

  function save() {
    start(async () => {
      const r = await saveSupplierAction(supplier?.id ?? null, v);
      if (r.ok) { toast.success(r.message ?? "Guardado"); setOpen(false); router.refresh(); if (!supplier) setV({ name: "", contact: "", paymentTerms: "", notes: "", active: true }); }
      else toast.error(r.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {supplier ? <Button size="sm" variant="ghost">Editar</Button> : <Button variant="gold"><PlusIcon /> Nuevo proveedor</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{supplier ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1"><Label>Nombre</Label><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
          <div className="grid gap-1"><Label>Contacto (nombre, teléfono, email)</Label><Input value={v.contact} onChange={(e) => setV({ ...v, contact: e.target.value })} /></div>
          <div className="grid gap-1"><Label>Términos de pago habituales</Label><Input value={v.paymentTerms} onChange={(e) => setV({ ...v, paymentTerms: e.target.value })} placeholder="30/60/90, contado…" /></div>
          <div className="grid gap-1"><Label>Notas</Label><Textarea rows={3} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></div>
          <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">Activo <Switch checked={v.active} onCheckedChange={(c) => setV({ ...v, active: c })} /></label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="gold" disabled={pending || v.name.trim().length < 2} onClick={save}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
