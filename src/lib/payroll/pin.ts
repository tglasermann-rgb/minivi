import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Hash de PIN de 4 dígitos con scrypt y sal. Formato: scrypt$<sal>$<hash>. */
export function hashPin(pin: string): string {
  if (!/^\d{4}$/.test(pin)) throw new Error("El PIN tiene que ser de 4 dígitos");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [alg, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(pin, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
