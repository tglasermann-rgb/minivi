import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCents } from "@/lib/money";
import { TYPE_LABELS } from "@/lib/inventory/constants";
import { TERMS_LABELS, type PaymentTerms } from "./terms";
import type { Purchase, PurchaseItem, Supplier, Payable } from "@/generated/prisma/client";

type Full = Purchase & { supplier: Supplier; items: PurchaseItem[]; payables: Payable[] };

const TABACO = rgb(0.243, 0.176, 0.118);
const ORO = rgb(0.753, 0.557, 0.227);
const GRIS = rgb(0.45, 0.4, 0.35);
const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/** Orden de compra en PDF (carta), con logo, para mandar al proveedor. */
export async function buildPurchaseOrderPdf(p: Full): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Purchase Order PO-${p.number}`);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(await readFile(path.join(process.cwd(), "public", "logo-dark.png")));

  let page = pdf.addPage([612, 792]);
  const M = 48;
  let y = 792 - M;

  const logoW = 110;
  page.drawImage(logo, { x: M, y: y - logoW * (logo.height / logo.width), width: logoW, height: logoW * (logo.height / logo.width) });
  page.drawText("PURCHASE ORDER", { x: 612 - M - bold.widthOfTextAtSize("PURCHASE ORDER", 16), y: y - 14, size: 16, font: bold, color: TABACO });
  page.drawText(`PO-${String(p.number).padStart(4, "0")}`, { x: 612 - M - bold.widthOfTextAtSize(`PO-${String(p.number).padStart(4, "0")}`, 12), y: y - 32, size: 12, font: bold, color: ORO });
  page.drawText(dateFmt.format(p.date), { x: 612 - M - font.widthOfTextAtSize(dateFmt.format(p.date), 10), y: y - 46, size: 10, font, color: GRIS });
  y -= 80;

  const text = (t: string, x: number, size = 10, f = font, color = TABACO) => page.drawText(t, { x, y, size, font: f, color });
  text("MiniVi Jewelry LLC", M, 10, bold); y -= 13;
  text("North Miami, FL", M, 9, font, GRIS); y -= 20;
  text("SUPPLIER", M, 8, bold, GRIS); y -= 12;
  text(p.supplier.name, M, 11, bold); y -= 13;
  if (p.supplier.contact) { text(p.supplier.contact, M, 9, font, GRIS); y -= 12; }
  if (p.invoiceNumber) { text(`Invoice / ref: ${p.invoiceNumber}`, M, 9, font, GRIS); y -= 12; }
  text(`Terms: ${TERMS_LABELS[p.paymentTerms as PaymentTerms] ?? p.paymentTerms}  ·  Gold cost: ${formatCents(p.costPerGramCents)}/g`, M, 9, font, GRIS);
  y -= 24;

  const cols = [
    { label: "#", x: M, w: 22 },
    { label: "Description", x: M + 24, w: 200 },
    { label: "Type", x: M + 228, w: 70 },
    { label: "Karat", x: M + 300, w: 34 },
    { label: "Grams", x: M + 336, w: 46, right: true },
    { label: "Qty", x: M + 384, w: 34, right: true },
    { label: "Unit cost", x: M + 420, w: 56, right: true },
    { label: "Total", x: M + 478, w: 38 + 0, right: true },
  ];
  const drawHeader = () => {
    page.drawRectangle({ x: M, y: y - 4, width: 612 - M * 2, height: 16, color: rgb(0.945, 0.922, 0.878) });
    for (const c of cols) {
      const w = bold.widthOfTextAtSize(c.label, 8);
      page.drawText(c.label, { x: c.right ? c.x + c.w - w : c.x, y, size: 8, font: bold, color: TABACO });
    }
    y -= 20;
  };
  drawHeader();
  const cell = (t: string, c: (typeof cols)[number], f = font) => {
    const w = f.widthOfTextAtSize(t, 9);
    page.drawText(t, { x: c.right ? c.x + c.w - w : c.x, y, size: 9, font: f, color: TABACO });
  };
  for (const it of p.items) {
    if (y < 120) {
      page = pdf.addPage([612, 792]);
      y = 792 - M;
      drawHeader();
    }
    const desc = it.description + (it.optionValue ? ` (${it.optionName ?? ""} ${it.optionValue})` : "");
    cell(String(it.position), cols[0]);
    cell(desc.length > 42 ? desc.slice(0, 41) + "…" : desc, cols[1]);
    cell(TYPE_LABELS[it.type], cols[2]);
    cell(it.karat, cols[3]);
    cell(Number(it.grams).toFixed(2), cols[4]);
    cell(String(it.qty), cols[5]);
    cell(formatCents(it.unitCostCents), cols[6]);
    cell(formatCents(it.unitCostCents * it.qty), cols[7], bold);
    y -= 15;
  }
  y -= 8;
  page.drawLine({ start: { x: M + 300, y }, end: { x: 612 - M, y }, thickness: 0.5, color: ORO });
  y -= 16;
  const totals: [string, number, boolean][] = [["Subtotal", p.subtotalCents, false], ["Tax", p.taxCents, false], ["Shipping", p.shippingCents, false], ["TOTAL", p.totalCents, true]];
  for (const [label, amount, strong] of totals) {
    const f = strong ? bold : font;
    page.drawText(label, { x: M + 300, y, size: strong ? 11 : 9, font: f, color: TABACO });
    const s = formatCents(amount);
    page.drawText(s, { x: 612 - M - f.widthOfTextAtSize(s, strong ? 11 : 9), y, size: strong ? 11 : 9, font: f, color: TABACO });
    y -= strong ? 18 : 14;
  }
  if (p.payables.length) {
    y -= 6;
    page.drawText("Payment schedule", { x: M, y, size: 9, font: bold, color: TABACO }); y -= 13;
    for (const c of p.payables) {
      page.drawText(`${dateFmt.format(c.dueOn)}   ${formatCents(c.amountCents)}${c.paidOn ? "   (paid)" : ""}`, { x: M, y, size: 9, font, color: GRIS });
      y -= 12;
    }
  }
  if (p.notes) {
    y -= 8;
    page.drawText("Notes", { x: M, y, size: 9, font: bold, color: TABACO }); y -= 13;
    for (const line of wrap(p.notes, 95)) { page.drawText(line, { x: M, y, size: 9, font, color: GRIS }); y -= 12; }
  }
  page.drawText("All items must be real 14k gold, stamped 14k, no plating.", { x: M, y: M, size: 8, font, color: GRIS });
  return pdf.save();
}

function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    let line = "";
    for (const word of para.split(" ")) {
      if ((line + " " + word).trim().length > max) { out.push(line.trim()); line = word; } else line += " " + word;
    }
    out.push(line.trim());
  }
  return out;
}
