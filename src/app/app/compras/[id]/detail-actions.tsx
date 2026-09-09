"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PackageCheckIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { payPayableAction, receivePurchaseAction, setPurchaseStatusAction, unpayPayableAction, uploadPurchaseDocAction } from "../actions";
import type { PurchaseStatus } from "@/generated/prisma/client";

type Line = { id: string; description: string; qty: number; qtyReceived: number; sku: string | null };

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

export function PurchaseDetailActions({ purchase }: { purchase: { id: string; status: PurchaseStatus; items: Line[] } }) {
  const { pending, run } = useRun();
  const [open, setOpen] = useState(false);
  const pendingLines = purchase.items.filter((l) => l.qtyReceived < l.qty);
  const [qtys, setQtys] = useState<Record<string, string>>(() => Object.fromEntries(pendingLines.map((l) => [l.id, String(l.qty - l.qtyReceived)])));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" disabled={pending}>Estado</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => run("…", () => setPurchaseStatusAction(purchase.id, "draft"))}>Borrador</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("…", () => setPurchaseStatusAction(purchase.id, "ordered"))}>Pedida al proveedor</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("…", () => setPurchaseStatusAction(purchase.id, "closed"))}>Cerrada</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {pendingLines.length > 0 && purchase.status !== "closed" && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button variant="gold"><PackageCheckIcon /> Recibir mercadería</Button></DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Recibir mercadería</DialogTitle>
              <DialogDescription>Por cada línea, cuántas unidades llegaron. Se crea el producto con SKU y precio, y entra el stock. Podés recibir parcial.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              {pendingLines.map((l) => (
                <div key={l.id} className="grid grid-cols-[1fr_90px] items-center gap-2 border-b py-1 last:border-0">
                  <div>
                    <p className="text-sm">{l.description}</p>
                    <p className="text-xs text-muted-foreground">{l.qtyReceived}/{l.qty} recibidas{l.sku ? ` · ${l.sku}` : ""}</p>
                  </div>
                  <Input type="number" min="0" max={l.qty - l.qtyReceived} step="1" className="font-mono" value={qtys[l.id] ?? ""} onChange={(e) => setQtys({ ...qtys, [l.id]: e.target.value })} />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button variant="gold" disabled={pending} onClick={() => run("Recibiendo…", () => receivePurchaseAction({ purchaseId: purchase.id, lines: pendingLines.map((l) => ({ itemId: l.id, qty: Number(qtys[l.id] ?? 0) })) }), () => setOpen(false))}>
                Confirmar recepción
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
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
