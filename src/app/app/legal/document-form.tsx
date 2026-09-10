"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PaperclipIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CATEGORY_HINTS, CATEGORY_LABELS, STATUS_LABELS } from "@/lib/legal/expiry";
import { saveDocumentAction } from "./actions";
import type { LegalCategory, LegalStatus } from "@/generated/prisma/client";

export type DocDefaults = {
  id?: string; title: string; category: LegalCategory; status: LegalStatus; counterparty: string; reference: string;
  effectiveOn: string; expiresOn: string; noticeDays: number; amount: number; notes: string;
};
const selectCls = "h-10 w-full rounded-md border border-input bg-card px-2 text-base md:text-sm";
const empty: DocDefaults = { title: "", category: "lease", status: "active", counterparty: "", reference: "", effectiveOn: "", expiresOn: "", noticeDays: 30, amount: 0, notes: "" };

export function DocumentForm({ doc, trigger }: { doc?: DocDefaults; trigger?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [v, setV] = useState<DocDefaults>(doc ?? empty);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? (doc ? <Button size="sm" variant="outline">Editar</Button> : <Button variant="gold"><PlusIcon /> Nuevo documento</Button>)}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{doc ? "Editar documento" : "Nuevo documento legal"}</DialogTitle>
          <DialogDescription>Contratos, pólizas, licencias y todo papel del negocio, con su archivo adjunto.</DialogDescription>
        </DialogHeader>
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const r = await saveDocumentAction(doc?.id ?? null, fd);
              if (r.ok) {
                toast.success(r.message ?? "Guardado");
                setOpen(false);
                if (!doc && r.data) router.push(`/app/legal/${r.data.id}`);
                else router.refresh();
                if (!doc) setV(empty);
              } else toast.error(r.error);
            });
          }}
          className="grid gap-3"
        >
          <div className="grid gap-1">
            <Label htmlFor="title">Título</Label>
            <Input id="title" name="title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Contrato de alquiler 123 NE 125th St" required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="category">Categoría</Label>
              <select id="category" name="category" className={selectCls} value={v.category} onChange={(e) => setV({ ...v, category: e.target.value as LegalCategory })}>
                {Object.entries(CATEGORY_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">{CATEGORY_HINTS[v.category]}</p>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="status">Estado</Label>
              <select id="status" name="status" className={selectCls} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as LegalStatus })}>
                {Object.entries(STATUS_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1"><Label htmlFor="counterparty">Con quién</Label><Input id="counterparty" name="counterparty" value={v.counterparty} onChange={(e) => setV({ ...v, counterparty: e.target.value })} placeholder="locador, aseguradora, proveedor…" /></div>
            <div className="grid gap-1"><Label htmlFor="reference">Nº de póliza / licencia / contrato</Label><Input id="reference" name="reference" className="font-mono" value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1"><Label htmlFor="effectiveOn">Desde</Label><Input id="effectiveOn" name="effectiveOn" type="date" className="font-mono" value={v.effectiveOn} onChange={(e) => setV({ ...v, effectiveOn: e.target.value })} /></div>
            <div className="grid gap-1"><Label htmlFor="expiresOn">Vence</Label><Input id="expiresOn" name="expiresOn" type="date" className="font-mono" value={v.expiresOn} onChange={(e) => setV({ ...v, expiresOn: e.target.value })} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="noticeDays">Avisarme con (días de anticipación)</Label>
              <Input id="noticeDays" name="noticeDays" type="number" min="0" max="365" className="font-mono" value={v.noticeDays} onChange={(e) => setV({ ...v, noticeDays: Number(e.target.value) })} />
              <p className="text-xs text-muted-foreground">Aparece en Inicio cuando falte ese tiempo. Para el alquiler conviene 90.</p>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="amount">Monto asociado (USD)</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0" className="font-mono" value={v.amount} onChange={(e) => setV({ ...v, amount: Number(e.target.value) })} />
              <p className="text-xs text-muted-foreground">Renta mensual, prima del seguro, honorarios. Dejar en 0 si no aplica.</p>
            </div>
          </div>
          <div className="grid gap-1"><Label htmlFor="notes">Notas</Label><Textarea id="notes" name="notes" rows={3} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} placeholder="Cláusulas importantes, cómo se renueva, a quién avisar…" /></div>
          <div className="grid gap-1">
            <Label htmlFor="files" className="flex items-center gap-1.5"><PaperclipIcon className="size-4" /> Archivos (PDF o foto, hasta 25 MB)</Label>
            <Input id="files" name="files" type="file" multiple accept=".pdf,image/*,.doc,.docx" className="h-10" />
            <p className="text-xs text-muted-foreground">Desde el celular podés sacarle una foto al papel. Se pueden agregar más después.</p>
          </div>
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="gold" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
