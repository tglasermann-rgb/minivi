import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { expensesCsv } from "@/lib/expenses/service";

/** GET /api/gastos?from=YYYY-MM-DD&to=YYYY-MM-DD → CSV para el contador. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const sp = new URL(request.url).searchParams;
  const from = new Date(`${sp.get("from") ?? "2000-01-01"}T00:00:00Z`);
  const to = new Date(`${sp.get("to") ?? "2100-01-01"}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return NextResponse.json({ error: "Fechas inválidas" }, { status: 400 });
  const csv = await expensesCsv(from, to);
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="gastos-${sp.get("from")}-${sp.get("to")}.csv"` } });
}
