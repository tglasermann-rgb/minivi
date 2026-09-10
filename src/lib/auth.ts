import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { createSupabaseServerClient } from "./supabase/server";
import { ownerEmails } from "./env";
import type { Role } from "@/generated/prisma/client";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
};

/**
 * Usuario actual con su perfil. Si es la primera vez que entra, crea el perfil:
 * rol "owner" si su email está en OWNER_EMAILS, si no "kiosk".
 * Cacheado por request (React cache) para no repetir la consulta en layout + page.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return null;

  const email = user.email.toLowerCase();
  let profile = await prisma.profile.findUnique({ where: { id: user.id } });

  if (!profile) {
    const role: Role = ownerEmails().includes(email) ? "owner" : "kiosk";
    profile = await prisma.profile.create({
      data: {
        id: user.id,
        email,
        fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
        role,
        createdBy: user.id,
      },
    });
  }

  return { id: profile.id, email: profile.email, fullName: profile.fullName, role: profile.role };
});

/** Exige sesión y rol owner; si no, redirige. */
export async function requireOwner(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "owner") redirect("/kiosk");
  return user;
}

/** Exige sesión (owner o kiosk). */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Ruta de inicio según rol. */
export function homeFor(role: Role): string {
  return role === "owner" ? "/app" : "/kiosk";
}
