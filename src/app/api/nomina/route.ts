import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getClosedPeriod, periodCsv, periodPdf } from "@/lib/payroll/service";
import { utcToKey } from "@/lib/payroll/periods";

/** GET /api/nomina?id=…&format=pdf|csv */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const sp = new URL(request.url).searchParams;
  const p = await getClosedPeriod(sp.get("id") ?? "");
  if (!p) return NextResponse.json({ error: "No existe" }, { status: 404 });
  const name = `nomina-${utcToKey(p.startsOn)}-${utcToKey(p.endsOn)}`;
  if (sp.get("format") === "csv") {
    return new NextResponse(periodCsv(p), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}.csv"` } });
  }
  const pdf = await periodPdf(p);
  return new NextResponse(Buffer.from(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${name}.pdf"` } });
}
