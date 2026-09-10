"use client";
import { useEffect } from "react";

/**
 * Pantalla de error del portal. Muestra en español qué pasó y el código (digest)
 * que permite encontrar el detalle en los logs de Vercel.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Error en el portal:", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-lg border bg-card p-6">
        <h1 className="font-display text-2xl">Algo falló al cargar esta pantalla</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Casi siempre es la conexión con la base de datos. Probá de nuevo; si sigue igual, abrí{" "}
          <a href="/api/health" className="text-oro-profundo underline">/api/health</a> y mandá lo que dice.
        </p>
        <div className="mt-4 rounded-md bg-muted p-3 font-mono text-xs break-words">
          {error.message || "Error del servidor"}
          {error.digest && <div className="mt-1 text-muted-foreground">digest: {error.digest}</div>}
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={reset} className="h-9 cursor-pointer rounded-md bg-oro px-4 text-sm font-medium text-tinta">Reintentar</button>
          <a href="/app" className="flex h-9 items-center rounded-md border px-4 text-sm">Ir a Inicio</a>
        </div>
      </div>
    </div>
  );
}
