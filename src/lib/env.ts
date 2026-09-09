/** Lectura centralizada de variables de entorno con mensajes claros. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Ver .env.example y docs/SETUP.md.`);
  }
  return value;
}

export function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
