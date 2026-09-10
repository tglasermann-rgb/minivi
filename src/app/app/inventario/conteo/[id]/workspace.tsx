"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CameraIcon, CameraOffIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CountDiff } from "@/lib/extras/counts";
import { applyAdjustmentsAction, closeCountAction, scanAction, setCountedAction } from "../actions";

export function CountWorkspace({ countId, status, lines }: { countId: string; status: "open" | "closed"; lines: CountDiff[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [manual, setManual] = useState("");
  const [last, setLast] = useState<{ sku: string; title: string; counted: number } | null>(null);
  const [camera, setCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  function scan(sku: string) {
    if (!sku.trim()) return;
    start(async () => {
      const r = await scanAction(countId, sku.trim());
      if (r.ok && r.data) { setLast(r.data); if (navigator.vibrate) navigator.vibrate(60); router.refresh(); }
      else if (!r.ok) toast.error(r.error);
    });
  }

  useEffect(() => {
    if (!camera || status !== "open") return;
    let cancelled = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
          if (!result || cancelled) return;
          const code = result.getText();
          const now = Date.now();
          if (code === lastScanRef.current.code && now - lastScanRef.current.at < 2500) return; // evita doble lectura
          lastScanRef.current = { code, at: now };
          scan(code);
        });
        stopRef.current = () => controls.stop();
      } catch {
        toast.error("No se pudo abrir la cámara. Tipeá el SKU o usá un lector USB.");
        setCamera(false);
      }
    })();
    return () => { cancelled = true; stopRef.current?.(); stopRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, status]);

  const run = (label: string, fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) => start(async () => { const t = toast.loading(label); const r = await fn(); toast.dismiss(t); if (r.ok) { toast.success(r.message ?? "Listo"); router.refresh(); } else toast.error(r.error ?? "Error"); });
  const diffs = lines.filter((l) => l.diff !== 0);
  const pendingAdj = diffs.filter((l) => !l.adjusted).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      {status === "open" && (
        <Card className="self-start">
          <CardHeader><CardTitle>Escanear</CardTitle><CardDescription>Cámara del celular, lector USB/Bluetooth (escribe el SKU y Enter) o a mano.</CardDescription></CardHeader>
          <CardContent className="grid gap-3">
            <Button variant={camera ? "outline" : "gold"} onClick={() => setCamera((c) => !c)}>{camera ? <><CameraOffIcon /> Apagar cámara</> : <><CameraIcon /> Abrir cámara</>}</Button>
            <video ref={videoRef} className={`w-full rounded-md bg-tinta ${camera ? "" : "hidden"}`} muted playsInline />
            <form onSubmit={(e) => { e.preventDefault(); scan(manual); setManual(""); }} className="flex gap-2">
              <Input autoFocus value={manual} onChange={(e) => setManual(e.target.value)} placeholder="MV-NK-0001" className="font-mono uppercase" />
              <Button type="submit" variant="outline" disabled={pending}>Sumar</Button>
            </form>
            {last && <div className="rounded-md bg-oro/15 px-3 py-2 text-sm"><CheckIcon className="mr-1 inline size-4 text-oro-profundo" /><span className="font-mono">{last.sku}</span> {last.title} → <b>{last.counted}</b></div>}
            <Button variant="default" disabled={pending} onClick={() => { if (confirm("¿Cerrar el conteo? Después se ven las diferencias y se pueden ajustar.")) run("Cerrando…", () => closeCountAction(countId)); }}>Terminar conteo</Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{status === "open" ? "Contado hasta ahora" : "Diferencias contra el sistema"}</CardTitle>
          {status === "closed" && (
            <CardDescription className="flex items-center justify-between gap-2">
              <span>{diffs.length === 0 ? "Todo coincide." : `${diffs.length} SKU con diferencia. Ajustar crea movimientos de pérdida o ajuste.`}</span>
              {pendingAdj > 0 && <Button size="sm" variant="gold" disabled={pending} onClick={() => { if (confirm(`¿Ajustar el stock de ${pendingAdj} SKU a lo contado?`)) run("Ajustando…", () => applyAdjustmentsAction(countId)); }}>Ajustar stock ({pendingAdj})</Button>}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Producto</TableHead><TableHead className="text-right">Sistema</TableHead><TableHead className="text-right">Contado</TableHead><TableHead className="text-right">Dif.</TableHead></TableRow></TableHeader>
            <TableBody>
              {lines.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nada escaneado todavía.</TableCell></TableRow>}
              {(status === "open" ? lines.filter((l) => l.counted > 0 || l.expected > 0) : lines).map((l) => (
                <TableRow key={l.productId} className={l.diff !== 0 ? (l.diff < 0 ? "bg-destructive/5" : "bg-oro/10") : ""}>
                  <TableCell className="font-mono text-xs">{l.sku}</TableCell>
                  <TableCell className="text-xs">{l.title}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{l.expected}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {status === "open" ? (
                      <input type="number" min="0" defaultValue={l.counted} className="w-16 rounded border px-1 text-right font-mono" onBlur={(e) => { const v = Number(e.target.value); if (v !== l.counted) start(async () => { const r = await setCountedAction(countId, l.productId, v); if (r.ok) router.refresh(); else toast.error(r.error); }); }} />
                    ) : l.counted}
                  </TableCell>
                  <TableCell className={`text-right font-mono text-xs ${l.diff < 0 ? "text-destructive" : l.diff > 0 ? "text-oro-profundo" : ""}`}>{l.diff > 0 ? `+${l.diff}` : l.diff}{l.adjusted && " ✓"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
