import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { requireEnv } from "./env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  const adapter = new PrismaPg({ connectionString: requireEnv("DATABASE_URL") });
  const client = new PrismaClient({ adapter });
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
