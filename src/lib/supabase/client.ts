"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Cliente de Supabase para componentes de cliente (solo Auth; los datos van por server actions). */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
