import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCents } from "@/lib/money";
import { monthLabel } from "@/lib/expenses/budget";
import type { MonthReport } from "./service";

const TAB = rgb(0.243, 0.176, 0.118);
const ORO = rgb(0.753, 0.557, 0.227);
const GR = rgb(0.45, 0.4, 0.35);
const ROJO = rgb(0.65, 0.24, 0.18);

export async function monthReportPdf(r: MonthReport, stop: { targetCents: number; cashCents: number; deltaCents: number; status: string } | null): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(await readFile(path.join(process.cwd(), "public", "logo-dark.png")));
  let page = pdf.addPage([612, 792]);
  const M = 48, W = 612 - M * 2;
  let y = 792 - M;
  const ensure = (need: number) => { if (y - need < M) { page = pdf.addPage([612, 792]); y = 792 - M; } };
  const text = (t: string, x: number, size = 10, f = font, color = TAB) => page.drawText(t, { x, y, size, font: f, color });
  const right = (t: string, size = 10, f = font, color = TAB) => page.drawText(t, { x: 612 - M - f.widthOfTextAtSize(t, size), y, size, font: f, color });
  const section = (title: string) => { ensure(40); y -= 14; page.drawRectangle({ x: M, y: y - 4, width: W, height: 16, color: rgb(0.945, 0.922, 0.878) }); text(title.toUpperCase(), M + 4, 8, bold); y -= 20; };
  const line = (label: string, value: string, opts: { bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number } = {}) => { ensure(14); text(label, M + (opts.indent ?? 0), 9.5, opts.bold ? bold : font, opts.color ?? TAB); right(value, 9.5, opts.bold ? bold : font, opts.color ?? TAB); y -= 14; };

  page.drawImage(logo, { x: M, y: y - 22, width: 110, height: 110 * (logo.height / logo.width) });
  right("Reporte mensual", 16, bold); y -= 18;
  right(`${monthLabel(r.month)}${r.planMonth > 0 ? ` · mes ${r.planMonth} del plan` : ""}`, 10, font, GR);
  y -= 50;

  section("Ventas");
  for (const s of r.sales) line(`${s.label} (${s.orders} órdenes)`, formatCents(s.netCents));
  line("Ventas netas", formatCents(r.salesNetCents), { bold: true });
  line(`Costo de lo vendido (${r.salesUnits} piezas)`, `−${formatCents(r.costOfSalesCents)}`);
  line("Margen bruto", formatCents(r.marginCents), { bold: true, color: r.marginCents >= 0 ? TAB : ROJO });

  section("Gastos (vs presupuesto del plan)");
  for (const e of r.expenses) line(`${e.category}${e.group === "opening" ? " (apertura)" : ""}`, `${formatCents(e.cents)}${e.budgetCents ? `   plan ${formatCents(e.budgetCents)}` : ""}`, { color: e.budgetCents && e.cents > e.budgetCents ? ROJO : TAB });
  line("Total gastos", `${formatCents(r.expensesCents)}   plan ${formatCents(r.expensesBudgetCents)}`, { bold: true });

  section("Nómina");
  line("Bruto de períodos cerrados", `${formatCents(r.payrollCents)}   plan ${formatCents(r.payrollBudgetCents)}`, { color: r.payrollCents > r.payrollBudgetCents ? ROJO : TAB });

  section("Resultado del mes");
  line("Margen bruto − gastos − nómina", formatCents(r.resultCents), { bold: true, color: r.resultCents >= 0 ? TAB : ROJO });
  line("Compras del mes (inventario)", formatCents(r.purchasesCents));
  line("Pagos a proveedores del mes", formatCents(r.payablesPaidCents));
  line("Caja del mes (ventas − gastos − nómina − pagos a proveedores)", formatCents(r.cashFlowCents), { bold: true, color: r.cashFlowCents >= 0 ? TAB : ROJO });

  if (stop) {
    section("Regla de parada");
    line("Caja real acumulada", formatCents(stop.cashCents), { bold: true });
    line("Caja objetivo del plan", formatCents(stop.targetCents));
    line("Diferencia", formatCents(stop.deltaCents), { bold: true, color: stop.status === "red" ? ROJO : stop.status === "warn" ? ORO : TAB });
    if (stop.status === "red") line("ALERTA: más de $20,000 por debajo del objetivo. Revisar el plan.", "", { bold: true, color: ROJO });
  }
  y -= 10; ensure(20);
  text("Generado por MiniVi OS. Ventas desde Shopify; gastos, nómina y compras cargados en el portal.", M, 7.5, font, GR);
  return pdf.save();
}
