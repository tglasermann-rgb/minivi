import Link from "next/link";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PinPad } from "./pin-pad";

export const metadata = { title: "Fichaje" };
export const dynamic = "force-dynamic";

export default async function KioskPage() {
  const [user, s] = await Promise.all([getCurrentUser(), getSettings()]);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-between p-6">
      <div className="flex w-full max-w-sm items-center justify-between">
        <Logo tone="oro" height={22} />
        <span className="font-mono text-xs text-sidebar-muted">{new Intl.DateTimeFormat("es-US", { weekday: "short", day: "2-digit", month: "short", timeZone: s.tienda_timezone }).format(new Date())}</span>
      </div>
      <PinPad cameraEnabled={s.kiosk_foto === "si"} />
      <div className="flex gap-4 text-xs text-sidebar-muted">
        {user?.role === "owner" && <Link href="/app" className="hover:text-oro-claro">Ir al portal</Link>}
        <a href="/auth/signout" className="hover:text-oro-claro">Cerrar sesión</a>
      </div>
    </div>
  );
}
