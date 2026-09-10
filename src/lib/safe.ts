import "server-only";

/**
 * Ejecuta una consulta y, si falla, devuelve un valor por defecto en vez de tirar
 * abajo toda la pantalla. Se usa en Inicio: que falle una tarjeta no debería
 * dejar el portal en "Application error".
 */
export async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[minivi] falló ${label}:`, e instanceof Error ? e.message : e);
    return fallback;
  }
}
