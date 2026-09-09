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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { saveEmployeeAction } from "./actions";

type E = { id?: string; name: string; pin: string; hourlyRate: string; hiredOn: string; active: boolean; phone: string; email: string; notes: string };

export function EmployeeDialog({ employee }: { employee?: E }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [v, setV] = useState<E>(employee ?? { name: "", pin: "", hourlyRate: "", hiredOn: "", active: true, phone: "", email: "", notes: "" });
  const save = () => start(async () => {
    const r = await saveEmployeeAction(employee?.id ?? null, v);
    if (r.ok) { toast.success(r.message ?? "Guardado"); setOpen(false); router.refresh(); }
    else toast.error(r.error + (r.fieldErrors ? ": " + Object.entries(r.fieldErrors).map(([k, m]) => `${k} ${m?.[0]}`).join(", ") : ""));
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{employee ? <Button size="sm" variant="ghost">Editar</Button> : <Button variant="gold"><PlusIcon /> Nueva empleada</Button>}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{employee ? "Editar empleada" : "Nueva empleada"}</DialogTitle>
          <DialogDescription>El PIN es lo único que usa en la tablet. No tiene usuario del portal.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1"><Label>Nombre</Label><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>PIN (4 dígitos){employee && <span className="text-xs text-muted-foreground"> · vacío = no cambiar</span>}</Label><Input inputMode="numeric" maxLength={4} className="font-mono" value={v.pin} onChange={(e) => setV({ ...v, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></div>
            <div className="grid gap-1"><Label>Tarifa por hora (USD)</Label><Input type="number" step="0.01" min="0" className="font-mono" value={v.hourlyRate} onChange={(e) => setV({ ...v, hourlyRate: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Fecha de ingreso</Label><Input type="date" className="font-mono" value={v.hiredOn} onChange={(e) => setV({ ...v, hiredOn: e.target.value })} /></div>
            <div className="grid gap-1"><Label>Teléfono</Label><Input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></div>
          </div>
          <div className="grid gap-1"><Label>Email</Label><Input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></div>
          <div className="grid gap-1"><Label>Notas</Label><Textarea rows={2} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></div>
          <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">Activa <Switch checked={v.active} onCheckedChange={(c) => setV({ ...v, active: c })} /></label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="gold" disabled={pending} onClick={save}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
