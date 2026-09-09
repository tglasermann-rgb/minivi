import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7: la URL de conexión vive acá, no en schema.prisma.
// DIRECT_URL = conexión directa a Supabase (puerto 5432) para migraciones.
// La app en runtime usa DATABASE_URL (pooler) desde src/lib/prisma.ts.
// Si DIRECT_URL falta, `prisma generate` sigue funcionando; `migrate` va a fallar
// con un error de conexión claro.
const directUrl =
  process.env.DIRECT_URL ??
  "postgresql://falta-DIRECT_URL@localhost:5432/minivi";

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
