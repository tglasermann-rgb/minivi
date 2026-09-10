"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { payPayableAction, unpayPayableAction, uploadPurchaseDocAction } from "../actions";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (label: string, fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) =>
    start(async () => {
      const t = toast.loading(label);
      const r = await fn();
      toast.dismiss(t);
      if (r.ok) { toast.success(r.message ?? "Listo"); after?.(); router.refresh(); } else toast.error(r.error ?? "Error");
    });
  return { pending, run };
}

export function PayableRowActions({ id, paid }: { id: string; paid: boolean }) {
  const { pending, run } = useRun();
  const [open, setOpen] = useState(false);
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("transferencia");
  if (paid) return <Button size="sm" variant="ghost" disabled={pending} onClick={() => run("…", () => unpayPayableAction(id))}>Deshacer</Button>;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline">Marcar pagada</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Marcar cuota como pagada</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1"><Label>Fecha de pago</Label><Input type="date" className="font-mono" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} /></div>
          <div className="grid gap-1"><Label>Método</Label><Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="transferencia, efectivo, tarjeta…" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="gold" disabled={pending} onClick={() => run("Guardando…", () => payPayableAction({ id, paidOn, method }), () => setOpen(false))}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AttachmentUpload({ purchaseId }: { purchaseId: string }) {
  const { pending, run } = useRun();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run("Subiendo…", () => uploadPurchaseDocAction(fd), () => { if (ref.current) ref.current.value = ""; });
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="purchaseId" value={purchaseId} />
      <Input ref={ref} type="file" name="file" accept="image/*,.pdf" className="max-w-xs" capture="environment" />
      <Button type="submit" size="sm" variant="outline" disabled={pending}><UploadIcon /> Adjuntar</Button>
    </form>
  );
}
