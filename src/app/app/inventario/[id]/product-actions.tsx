"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagesIcon, PackagePlusIcon, StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REASON_LABELS } from "@/lib/inventory/constants";
import { adjustStockAction, findPhotosAction, publishShopifyAction } from "../actions";

export function ProductActions({ productId, sku, published }: { productId: string; sku: string; published: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState<keyof typeof REASON_LABELS>("adjustment");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  function run(label: string, fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) {
    start(async () => {
      const t = toast.loading(label);
      const r = await fn();
      toast.dismiss(t);
      if (r.ok) { toast.success(r.message ?? "Listo"); after?.(); router.refresh(); }
      else toast.error(r.error ?? "Error");
    });
  }

  return (
    <>
      <Button variant="outline" disabled={pending} onClick={() => run("Buscando fotos…", () => findPhotosAction([productId]))}><ImagesIcon /> Buscar fotos</Button>
      <Button variant="outline" disabled={pending} onClick={() => run("Publicando…", () => publishShopifyAction([productId]))}><StoreIcon /> {published ? "Actualizar en Shopify" : "Publicar en Shopify"}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button variant="gold"><PackagePlusIcon /> Ajustar stock</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar stock de {sku}</DialogTitle>
            <DialogDescription>Crea un movimiento. Positivo suma, negativo resta. Queda en el historial.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="qty">Cantidad (+ / −)</Label>
              <Input id="qty" type="number" step="1" className="font-mono" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Motivo</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as keyof typeof REASON_LABELS)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(REASON_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ref">Referencia (opcional)</Label>
              <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Nº de compra, orden, conteo…" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note">Nota</Label>
              <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="gold" disabled={pending} onClick={() => run("Ajustando…", () => adjustStockAction({ productId, qty: Number(qty), reason, reference, note }), () => { setOpen(false); setQty("1"); setReference(""); setNote(""); })}>
              Guardar movimiento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
