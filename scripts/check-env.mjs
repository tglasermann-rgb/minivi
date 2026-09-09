// Verifica antes del build que estén las variables necesarias y explica cómo cargarlas.
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "DATABASE_URL",
];
const missing = required.filter((k) => !process.env[k]);
const problems = [];

for (const k of ["DATABASE_URL", "DIRECT_URL"]) {
  const v = process.env[k];
  if (v && !/^postgres(ql)?:\/\//.test(v)) problems.push(`${k} tiene que empezar con postgresql:// (ahora empieza con "${v.slice(0, 12)}…")`);
  if (v && v.includes("[YOUR-PASSWORD]")) problems.push(`${k} todavía tiene [YOUR-PASSWORD]: reemplazalo por la contraseña de la base`);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (url && !/^https:\/\/.+\.supabase\.co\/?$/.test(url)) problems.push(`NEXT_PUBLIC_SUPABASE_URL tiene que ser https://xxxx.supabase.co (ahora es "${url}")`);

if (missing.length || problems.length) {
  console.error("\n✖ Faltan o están mal variables de entorno. En Vercel: Settings → Environment Variables.");
  console.error("  Cada variable tiene que estar marcada para Production, Preview y Development.\n");
  for (const k of missing) console.error(`  - Falta ${k}`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error("\n  Guía: docs/GUIA-FACIL.md, paso 4.\n");
  process.exit(1);
}
if (!process.env.DIRECT_URL) console.log("ℹ DIRECT_URL no está definida; se usa DATABASE_URL para las migraciones.");
console.log("✓ Variables de entorno OK");
