import { NextResponse } from "next/server";
import { pingDatabase } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico: dice si están las variables de entorno y si la base responde.
 * No expone ningún valor secreto, solo si está cargado y con qué forma.
 */
export async function GET() {
  const shape = (name: string, expect?: RegExp) => {
    const v = process.env[name];
    if (!v) return "FALTA";
    if (expect && !expect.test(v)) return "CARGADA PERO CON FORMATO RARO";
    return "ok";
  };
  const dbHost = (() => {
    try {
      const u = new URL(process.env.DATABASE_URL ?? "");
      return `${u.hostname}:${u.port || "5432"}`;
    } catch {
      return null;
    }
  })();

  const db = await pingDatabase();
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: shape("NEXT_PUBLIC_SUPABASE_URL", /^https:\/\/.+\.supabase\.co\/?$/),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: shape("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: shape("SUPABASE_SERVICE_ROLE_KEY"),
    DATABASE_URL: shape("DATABASE_URL", /^postgres(ql)?:\/\//),
    DIRECT_URL: process.env.DIRECT_URL ? shape("DIRECT_URL", /^postgres(ql)?:\/\//) : "no definida (se usa DATABASE_URL)",
    OWNER_EMAILS: shape("OWNER_EMAILS"),
    SHOPIFY_STORE_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN ? "ok" : "no configurado (Ventas queda vacío)",
    SHOPIFY_ADMIN_TOKEN: process.env.SHOPIFY_ADMIN_TOKEN ? "ok" : "no configurado",
    SHOPIFY_WEBHOOK_SECRET: process.env.SHOPIFY_WEBHOOK_SECRET ? "ok" : "no configurado",
    GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ? "ok" : "no configurado (fotos de Drive)",
    CRON_SECRET: process.env.CRON_SECRET ? "ok" : "no configurado",
  };

  return NextResponse.json(
    {
      ok: db.ok,
      base_de_datos: db.ok ? { estado: "responde", ms: db.ms, host: dbHost } : { estado: "NO RESPONDE", error: db.error, host: dbHost },
      variables: env,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      hora: new Date().toISOString(),
    },
    { status: db.ok ? 200 : 500 },
  );
}
