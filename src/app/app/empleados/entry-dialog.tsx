"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { deleteEntryAction, saveEntryAction } from "./actions";

type Entry = { id?: string; employeeId: string; date: string; timeIn: string; timeOut: string; breakMinutes: number; note: string };
const selectCls = "h-9 w-full rounded-md border border-input bg-card px-2 text-sm";

export function EntryDialog({ employees, entry }: { employees: { id: string; name: string }[]; entry?: Entry }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [v, setV] = useState<Entry>(entry ?? { employeeId: employees[0]?.id ?? "", date: new Date().toISOString().slice(0, 10), timeIn: "10:00", timeOut: "18:00", breakMinutes: 0, note: "" });
  const save = () => start(async () => {
    const r = await saveEntryAction(entry?.id ?? null, v);
    if (r.ok) { toast.success(r.message ?? "Guardado"); setOpen(false); router.refresh(); } else toast.error(r.error);
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{entry ? <Button size="icon" variant="ghost" aria-label="Editar"><PencilIcon /></Button> : <Button size="sm" variant="outline"><PlusIcon /> Entrada manual</Button>}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry ? "Corregir entrada" : "Entrada manual"}</DialogTitle>
          <DialogDescription>Horas en hora local de la tienda. La corrección queda en el historial con tu usuario.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1"><Label>Empleada</Label><select className={selectCls} value={v.employeeId} onChange={(e) => setV({ ...v, employeeId: e.target.value })}>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1"><Label>Día</Label><Input type="date" className="font-mono" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></div>
            <div className="grid gap-1"><Label>Entrada</Label><Input type="time" className="font-mono" value={v.timeIn} onChange={(e) => setV({ ...v, timeIn: e.target.value })} /></div>
            <div className="grid gap-1"><Label>Salida</Label><Input type="time" className="font-mono" value={v.timeOut} onChange={(e) => setV({ ...v, timeOut: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Descanso (min)</Label><Input type="number" min="0" step="5" className="font-mono" value={v.breakMinutes} onChange={(e) => setV({ ...v, breakMinutes: Number(e.target.value) })} /></div>
            <div className="grid gap-1"><Label>Nota</Label><Input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="gold" disabled={pending} onClick={save}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteEntryButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button size="icon" variant="ghost" aria-label="Borrar" disabled={pending} onClick={() => { if (!confirm("¿Borrar esta entrada?")) return; start(async () => { const r = await deleteEntryAction(id); if (r.ok) { toast.success(r.message ?? "Listo"); router.refresh(); } else toast.error(r.error); }); }}>
      <Trash2Icon className="text-destructive" />
    </Button>
  );
}
