"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DatabaseBackupIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { backupNowAction } from "../actions";

export function BackupNowButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <Button variant="gold" disabled={pending} onClick={() => start(async () => { const t = toast.loading("Generando backup…"); const r = await backupNowAction(); toast.dismiss(t); if (r.ok) { toast.success(r.message ?? "Listo"); router.refresh(); } else toast.error(r.error); })}><DatabaseBackupIcon /> Hacer backup ahora</Button>;
}
