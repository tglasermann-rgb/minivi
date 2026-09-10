import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";

/** Cliente de Supabase con service role: solo para Storage desde el servidor. */
export function supabaseAdmin() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const ensured = new Set<string>();

/** Crea el bucket si no existe (idempotente). */
export async function ensureBucket(name: string, isPublic: boolean) {
  if (ensured.has(name)) return;
  const sb = supabaseAdmin();
  const { data } = await sb.storage.getBucket(name);
  if (!data) {
    const { error } = await sb.storage.createBucket(name, { public: isPublic });
    if (error && !/already exists/i.test(error.message)) throw new Error(`No se pudo crear el bucket ${name}: ${error.message}`);
  }
  ensured.add(name);
}

export async function uploadToBucket(bucket: string, path: string, body: Buffer | Uint8Array | Blob, contentType: string, isPublic: boolean): Promise<string> {
  await ensureBucket(bucket, isPublic);
  const sb = supabaseAdmin();
  const { error } = await sb.storage.from(bucket).upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`Error subiendo ${path}: ${error.message}`);
  if (isPublic) return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  return path;
}

/** URL firmada (1 hora) para archivos de buckets privados. */
export async function signedUrl(bucket: string, path: string, seconds = 3600): Promise<string> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, seconds);
  if (error || !data) throw new Error(`No se pudo firmar ${path}: ${error?.message}`);
  return data.signedUrl;
}
