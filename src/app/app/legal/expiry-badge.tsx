import { Badge } from "@/components/ui/badge";
import { expiryLabel, type ExpiryState } from "@/lib/legal/expiry";

/** Etiqueta de vencimiento: rojo si venció, oro si está dentro del aviso previo. */
export function ExpiryBadge({ state, days }: { state: ExpiryState; days: number | null }) {
  if (state === "vencido") return <Badge variant="destructive">{expiryLabel(days)}</Badge>;
  if (state === "por_vencer") return <Badge variant="gold">{expiryLabel(days)}</Badge>;
  if (state === "sin_vencimiento") return <span className="text-xs text-muted-foreground">sin vencimiento</span>;
  return <span className="text-xs text-muted-foreground">{expiryLabel(days)}</span>;
}
