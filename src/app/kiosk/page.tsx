import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";

export const metadata = { title: "Kiosco" };

export default async function KioskPage() {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 p-8 text-center">
      <Logo tone="oro" height={32} />
      <div>
        <p className="font-display text-2xl">Fichaje</p>
        <p className="mt-2 max-w-sm text-sm text-sidebar-muted">
          El teclado de PIN para entrada y salida llega en la fase 4. Esta tablet queda lista con el usuario <span className="font-mono">{user?.email}</span>.
        </p>
      </div>
      <div className="flex gap-4 text-sm">
        {user?.role === "owner" && <Link href="/app" className="text-oro-claro underline-offset-4 hover:underline">Ir al portal</Link>}
        <a href="/auth/signout" className="text-sidebar-muted underline-offset-4 hover:underline">Cerrar sesión</a>
      </div>
    </div>
  );
}
