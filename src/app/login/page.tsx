import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

/** Identificador corto del deploy (commit de git en Vercel) para saber qué versión está publicada. */
function buildVersion(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA;
  return sha ? sha.slice(0, 7) : "local";
}

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="grid min-h-dvh md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-tinta p-10 text-sidebar-foreground md:flex">
        <Logo tone="oro" height={28} />
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-oro-profundo">MiniVi Jewelry · North Miami</p>
          <p className="mt-3 max-w-sm font-display text-3xl leading-tight">
            Oro de uso diario, <span className="text-oro-claro">hecho para heredarse.</span>
          </p>
        </div>
        <p className="text-xs text-sidebar-muted">Portal interno. Acceso solo para el equipo.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden">
            <Logo tone="tabaco" height={24} />
          </div>
          <h1 className="text-2xl">Entrar</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">Usá tu email y contraseña.</p>
          <LoginForm next={next} />
          <p className="mt-8 text-center font-mono text-[10px] text-muted-foreground/70">versión {buildVersion()}</p>
        </div>
      </div>
    </div>
  );
}
