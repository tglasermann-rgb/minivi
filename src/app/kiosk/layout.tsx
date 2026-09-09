import { requireUser } from "@/lib/auth";

/** Zona de la tablet de la tienda. Entran kiosk y también owner. */
export default async function KioskLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="min-h-dvh bg-tinta text-sidebar-foreground">{children}</div>;
}
