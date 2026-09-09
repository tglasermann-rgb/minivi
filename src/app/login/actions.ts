"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Ingresá la contraseña"),
  next: z.string().optional(),
});

export type LoginState = { error?: string };

/** Traduce los errores de Supabase Auth a algo accionable en español. */
function describeAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("not confirmed")) {
    return "Tu usuario existe pero no está confirmado. En Supabase → Authentication → Users, borrá el usuario y crealo de nuevo marcando \"Auto Confirm User\".";
  }
  if (m.includes("invalid login credentials") || m.includes("invalid credentials")) {
    return "Email o contraseña incorrectos. Revisá el usuario en Supabase → Authentication → Users.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Demasiados intentos seguidos. Esperá un minuto y probá de nuevo.";
  }
  if (m.includes("invalid api key") || m.includes("jwt")) {
    return "La clave de Supabase configurada en Vercel no es válida (NEXT_PUBLIC_SUPABASE_ANON_KEY).";
  }
  return `No se pudo iniciar sesión: ${message}`;
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: describeAuthError(error.message) };

  // "/" decide según rol (owner → /app, kiosk → /kiosk). Solo aceptamos rutas internas.
  const next = parsed.data.next;
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
}
