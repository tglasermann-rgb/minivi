import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Stat } from "@/components/ui/stat";
import { prisma } from "@/lib/prisma";
import { countDiff } from "@/lib/extras/counts";
import { CountWorkspace } from "./workspace";

export const dynamic = "force-dynamic";

export default async function ConteoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const count = await prisma.inventoryCount.findUnique({ where: { id } });
  if (!count) notFound();
  const d = await countDiff(id);
  const diffs = d.lines.filter((l) => l.diff !== 0);
  const missing = diffs.filter((l) => l.diff < 0).reduce((s, l) => s + -l.diff, 0);
  const extra = diffs.filter((l) => l.diff > 0).reduce((s, l) => s + l.diff, 0);
  return (
    <>
      <div className="mb-2"><Link href="/app/inventario/conteo" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" /> Conteos</Link></div>
      <PageHeader eyebrow="Conteo físico" title={d.note || "Conteo"} description={d.status === "open" ? "Escaneá las etiquetas. Cada lectura suma 1 al SKU. Podés corregir la cantidad a mano." : "Conteo cerrado: diferencias contra el stock del sistema al momento del cierre."} actions={<Badge variant={d.status === "open" ? "gold" : "outline"}>{d.status === "open" ? "abierto" : "cerrado"}</Badge>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Piezas escaneadas" value={String(d.scanned)} />
        <Stat label="SKU con diferencia" value={String(diffs.length)} />
        <Stat label="Faltantes" value={String(missing)} className={missing ? "border-destructive/50" : ""} />
        <Stat label="Sobrantes" value={String(extra)} className={extra ? "border-oro/60" : ""} />
      </div>
      <CountWorkspace countId={id} status={d.status} lines={d.lines} />
    </>
  );
}
