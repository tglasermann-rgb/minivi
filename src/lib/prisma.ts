import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { requireEnv } from "./env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * En Vercel cada función serverless abre su propio pool. Supabase (plan free)
 * admite pocas conexiones simultáneas, así que el pool tiene que ser chico y
 * soltar las conexiones ociosas rápido; si no, aparecen errores de
 * "too many connections" o timeouts al conectar.
 */
function poolOptions() {
  const isServerless = Boolean(process.env.VERCEL);
  return {
    max: Number(process.env.DATABASE_POOL_MAX ?? (isServerless ? 2 : 10)),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // Supabase corta conexiones ociosas; keepAlive evita usar una ya muerta.
    keepAlive: true,
  };
}

function getClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  const adapter = new PrismaPg({ connectionString: requireEnv("DATABASE_URL"), ...poolOptions() });
  const client = new PrismaClient({ adapter, log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"] });
  // Singleton también en producción: en serverless cada instancia tiene su propio globalThis.
  globalForPrisma.prisma = client;
  return client;
}

/**
 * Cliente de Prisma. Se crea recién en el primer uso, así `next build`
 * no necesita DATABASE_URL y el error por variable faltante aparece
 * en runtime con un mensaje claro.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/** Chequeo de conexión para /api/health. */
export async function pingDatabase(): Promise<{ ok: true; ms: number } | { ok: false; error: string }> {
  const t = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, ms: Date.now() - t };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
