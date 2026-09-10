import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { monthReport, payrollCsv, salesCsv, stopRule } from "@/lib/reports/service";
import { monthReportPdf } from "@/lib/reports/pdf";
import { expensesCsv } from "@/lib/expenses/service";

/**
 * GET /api/reportes?month=YYYY-MM            → PDF del reporte mensual
 * GET /api/reportes?type=ventas|gastos|nomina&from=YYYY-MM-DD&to=YYYY-MM-DD → CSV contable
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const sp = new URL(request.url).searchParams;
  const month = sp.get("month");
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [r, rule] = await Promise.all([monthReport(month), stopRule()]);
    const row = rule.rows.find((x) => x.month === month);
    const pdf = await monthReportPdf(r, row && row.status !== "future" ? row : null);
    return new NextResponse(Buffer.from(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="reporte-${month}.pdf"` } });
  }
  const type = sp.get("type") ?? "ventas";
  const from = new Date(`${sp.get("from") ?? "2000-01-01"}T00:00:00Z`);
  const toDay = new Date(`${sp.get("to") ?? "2100-01-01"}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(toDay.getTime())) return NextResponse.json({ error: "Fechas inválidas" }, { status: 400 });
  const toExclusive = new Date(toDay.getTime() + 24 * 3_600_000);
  const csv = type === "gastos" ? await expensesCsv(from, toDay) : type === "nomina" ? await payrollCsv(from, toExclusive) : await salesCsv(from, toExclusive);
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${type}-${sp.get("from")}-${sp.get("to")}.csv"` } });
}
