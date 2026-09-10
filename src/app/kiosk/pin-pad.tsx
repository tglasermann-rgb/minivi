"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { DeleteIcon, LogInIcon, LogOutIcon } from "lucide-react";
import { clockAction } from "./actions";

type Status = { kind: "idle" } | { kind: "ok"; name: string; action: "in" | "out"; at: Date; hours?: number } | { kind: "error"; message: string };
const timeFmt = new Intl.DateTimeFormat("es-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" });

export function PinPad({ cameraEnabled }: { cameraEnabled: boolean }) {
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, start] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);

  useEffect(() => {
    if (!cameraEnabled) return;
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 }, audio: false })
      .then((s) => { if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; } streamRef.current = s; if (videoRef.current) videoRef.current.srcObject = s; setCameraOn(true); })
      .catch(() => setCameraOn(false));
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, [cameraEnabled]);

  useEffect(() => {
    if (status.kind === "idle") return;
    const t = setTimeout(() => setStatus({ kind: "idle" }), 6000);
    return () => clearTimeout(t);
  }, [status]);

  async function snapshot(): Promise<Blob | null> {
    const v = videoRef.current;
    if (!cameraOn || !v || v.videoWidth === 0) return null;
    const c = document.createElement("canvas");
    c.width = 320; c.height = Math.round((320 * v.videoHeight) / v.videoWidth);
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    return new Promise((res) => c.toBlob((b) => res(b), "image/jpeg", 0.7));
  }

  function submit(value: string) {
    start(async () => {
      const fd = new FormData();
      fd.set("pin", value);
      const photo = await snapshot();
      if (photo) fd.set("photo", photo, "clock.jpg");
      const r = await clockAction(fd);
      setPin("");
      if (r.ok) setStatus({ kind: "ok", name: r.result.employeeName, action: r.result.action, at: new Date(r.result.at), hours: r.result.hoursToday });
      else setStatus({ kind: "error", message: r.error });
    });
  }

  function press(d: string) {
    if (pending) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) submit(next);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, pending]);

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6">
      <div className="h-24 w-full">
        {status.kind === "ok" && (
          <div className="flex h-full flex-col items-center justify-center rounded-xl bg-oro/15 text-center">
            <p className="flex items-center gap-2 font-display text-2xl text-oro-claro">{status.action === "in" ? <LogInIcon /> : <LogOutIcon />} {status.action === "in" ? "Entrada" : "Salida"} · {status.name}</p>
            <p className="font-mono text-sm text-sidebar-muted">{timeFmt.format(status.at)}{status.hours != null ? ` · ${status.hours} h hoy` : ""}</p>
          </div>
        )}
        {status.kind === "error" && (
          <div className="flex h-full items-center justify-center rounded-xl bg-destructive/20 px-4 text-center text-sm text-crema">{status.message}</div>
        )}
        {status.kind === "idle" && (
          <div className="flex h-full items-center justify-center text-sm text-sidebar-muted">{pending ? "Registrando…" : "Ingresá tu PIN de 4 dígitos"}</div>
        )}
      </div>

      <div className="flex gap-4" aria-label="PIN">
        {[0, 1, 2, 3].map((i) => <span key={i} className={`size-5 rounded-full border-2 border-oro transition-colors ${pin.length > i ? "bg-oro" : "bg-transparent"}`} />)}
      </div>

      <div className="grid w-full grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} disabled={pending} className="h-20 rounded-2xl bg-sidebar-accent font-display text-3xl text-crema transition-colors active:bg-oro active:text-tinta">{d}</button>
        ))}
        <span />
        <button type="button" onClick={() => press("0")} disabled={pending} className="h-20 rounded-2xl bg-sidebar-accent font-display text-3xl text-crema transition-colors active:bg-oro active:text-tinta">0</button>
        <button type="button" onClick={() => setPin((p) => p.slice(0, -1))} disabled={pending} aria-label="Borrar" className="flex h-20 items-center justify-center rounded-2xl bg-sidebar-accent text-crema active:bg-oro active:text-tinta"><DeleteIcon className="size-7" /></button>
      </div>

      <video ref={videoRef} autoPlay muted playsInline className={`w-28 rounded-lg ${cameraOn ? "opacity-60" : "hidden"}`} />
    </div>
  );
}
