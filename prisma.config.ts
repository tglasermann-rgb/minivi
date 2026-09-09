import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7: la URL de conexión vive acá, no en schema.prisma.
// DIRECT_URL = conexión a Supabase (session pooler, puerto 5432) para migraciones.
// Si no está, se usa DATABASE_URL. La app en runtime usa DATABASE_URL desde src/lib/prisma.ts.
// Si no hay ninguna, `prisma generate` sigue funcionando y `migrate` falla con
// un error de conexión (scripts/check-env.mjs lo avisa antes en Vercel).
const directUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  "postgresql://faltan-DATABASE_URL-y-DIRECT_URL@localhost:5432/minivi";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: directUrl,
  },
});
