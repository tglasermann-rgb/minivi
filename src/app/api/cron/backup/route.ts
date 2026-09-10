import { NextResponse } from "next/server";
import { runBackup } from "@/lib/extras/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Cron semanal: backup completo de la base al bucket privado `backups`. */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try { const b = await runBackup("cron"); return NextResponse.json({ ok: true, path: b.path, rows: b.rows, sizeBytes: b.sizeBytes }); }
  catch (e) { return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 }); }
}
