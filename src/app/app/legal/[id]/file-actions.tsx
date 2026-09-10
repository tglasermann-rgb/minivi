"use client";
import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2Icon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteFileAction, terminateDocumentAction, uploadFilesAction } from "../actions";

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

export function FileUpload({ documentId }: { documentId: string }) {
  const { pending, run } = useRun();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run("Subiendo…", () => uploadFilesAction(documentId, fd), () => { if (ref.current) ref.current.value = ""; });
      }}
      className="flex flex-wrap items-center gap-2 border-t pt-3"
    >
      <Input ref={ref} type="file" name="files" multiple accept=".pdf,image/*,.doc,.docx" capture="environment" className="max-w-xs" />
      <Button type="submit" size="sm" variant="outline" disabled={pending}><UploadIcon /> Subir</Button>
    </form>
  );
}

export function DeleteFileButton({ fileId, documentId, name }: { fileId: string; documentId: string; name: string }) {
  const { pending, run } = useRun();
  return (
    <Button size="icon" variant="ghost" aria-label={`Borrar ${name}`} disabled={pending} onClick={() => { if (confirm(`¿Borrar "${name}"? No se puede deshacer.`)) run("Borrando…", () => deleteFileAction(fileId, documentId)); }}>
      <Trash2Icon className="text-destructive" />
    </Button>
  );
}

export function TerminateButton({ id }: { id: string }) {
  const { pending, run } = useRun();
  return (
    <Button variant="outline" disabled={pending} onClick={() => { if (confirm("¿Marcar como terminado? El documento y sus archivos se conservan.")) run("Guardando…", () => terminateDocumentAction(id)); }}>
      Marcar terminado
    </Button>
  );
}
