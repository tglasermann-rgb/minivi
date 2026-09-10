import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoProps = {
  /** oro (default), tabaco o crema */
  tone?: "oro" | "tabaco" | "crema";
  /** alto en px; el ancho se calcula (relación 990:190) */
  height?: number;
  className?: string;
};

const src = { oro: "/logo.svg", tabaco: "/logo-dark.svg", crema: "/logo-crema.svg" } as const;

/** Logotipo minivi. Debajo de ~13 px de alto usar <Isotipo />. */
export function Logo({ tone = "oro", height = 22, className }: LogoProps) {
  const width = Math.round((height * 990) / 190);
  return <Image src={src[tone]} alt="minivi" width={width} height={height} priority className={cn("select-none", className)} />;
}

export function Isotipo({ size = 24, className }: { size?: number; className?: string }) {
  return <Image src="/isotipo.svg" alt="minivi" width={size} height={size} className={cn("rounded-sm", className)} />;
}
