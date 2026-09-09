// Seed idempotente: asegura que existan los settings por defecto.
// La migración inicial ya los inserta; esto sirve para bases nuevas o reseteadas.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { SETTING_DEFAULTS } from "../src/lib/settings-defaults";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("Falta DIRECT_URL o DATABASE_URL en .env");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: String(value) },
      update: {},
    });
  }
  console.log("Settings listos:", Object.keys(SETTING_DEFAULTS).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
