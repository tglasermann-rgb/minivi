"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ScanBarcodeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createCountAction } from "./actions";

export function NewCountButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="gold" disabled={pending} onClick={() => { const note = prompt("Nota del conteo (opcional):") ?? ""; start(async () => { const r = await createCountAction(note); if (r.ok && r.data) router.push(`/app/inventario/conteo/${r.data.id}`); else if (!r.ok) toast.error(r.error); }); }}>
      <ScanBarcodeIcon /> Nuevo conteo
    </Button>
  );
}
