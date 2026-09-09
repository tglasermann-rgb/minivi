import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import bwipjs from "bwip-js/node";
import { formatCents } from "./money";

/**
 * Etiqueta mariposa de joyería 2.2" × 0.5" (158.4 × 36 pt).
 * Layout (ver docs/LABELS.md):
 *   [ ala izquierda 0.75" | cola 0.70" | ala derecha 0.75" ]
 *   ala izq: código de barras Code 128 (SKU) + SKU en texto
 *   cola:    SKU en texto chico (queda enrollada en la pieza)
 *   ala der: precio, gramos y kilataje
 * Una etiqueta por página del PDF: la impresora (Zebra/Dymo) toma cada página como una etiqueta.
 */
export const LABEL_WIDTH_PT = 2.2 * 72;
export const LABEL_HEIGHT_PT = 0.5 * 72;
const WING_PT = 0.75 * 72;
const MARGIN = 3;

export type LabelItem = { sku: string; priceCents: number; grams: number; karat: string };

async function barcodePng(text: string): Promise<Uint8Array> {
  const png = await bwipjs.toBuffer({
    bcid: "code128",
    text,
    scale: 3,
    height: 6, // mm
    includetext: false,
    paddingwidth: 0,
    paddingheight: 0,
  });
  return new Uint8Array(png);
}

export async function buildLabelsPdf(items: LabelItem[], opts: { copies?: number } = {}): Promise<Uint8Array> {
  const copies = Math.max(1, opts.copies ?? 1);
  const pdf = await PDFDocument.create();
  pdf.setTitle("Etiquetas minivi");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);

  for (const item of items) {
    const png = await pdf.embedPng(await barcodePng(item.sku));
    for (let c = 0; c < copies; c++) {
      const page = pdf.addPage([LABEL_WIDTH_PT, LABEL_HEIGHT_PT]);
      const h = LABEL_HEIGHT_PT;

      // Ala izquierda: barcode arriba, SKU abajo
      const bcMaxW = WING_PT - MARGIN * 2;
      const bcH = 18;
      const scale = Math.min(bcMaxW / png.width, bcH / png.height);
      const bcW = png.width * scale;
      page.drawImage(png, { x: MARGIN + (bcMaxW - bcW) / 2, y: h - MARGIN - bcH, width: bcW, height: png.height * scale });
      const skuSize = 6;
      const skuW = bold.widthOfTextAtSize(item.sku, skuSize);
      page.drawText(item.sku, { x: MARGIN + (bcMaxW - skuW) / 2, y: MARGIN + 2, size: skuSize, font: bold, color: black });

      // Cola: SKU chico, centrado verticalmente
      const tailX = WING_PT;
      const tailW = LABEL_WIDTH_PT - WING_PT * 2;
      const tailSize = 5;
      const tailText = item.sku;
      const tailTextW = font.widthOfTextAtSize(tailText, tailSize);
      page.drawText(tailText, { x: tailX + (tailW - tailTextW) / 2, y: h / 2 - tailSize / 2 + 1, size: tailSize, font, color: black });

      // Ala derecha: precio grande, gramos y kilataje
      const rx = LABEL_WIDTH_PT - WING_PT + MARGIN;
      const rw = WING_PT - MARGIN * 2;
      const price = formatCents(item.priceCents).replace(/\.00$/, "");
      const priceSize = 11;
      const priceW = bold.widthOfTextAtSize(price, priceSize);
      page.drawText(price, { x: rx + (rw - priceW) / 2, y: h - MARGIN - priceSize, size: priceSize, font: bold, color: black });
      const meta = `${item.grams.toFixed(2)} g · ${item.karat}`;
      const metaSize = 6;
      const metaW = font.widthOfTextAtSize(meta, metaSize);
      page.drawText(meta, { x: rx + (rw - metaW) / 2, y: MARGIN + 2, size: metaSize, font, color: black });
    }
  }
  return pdf.save();
}
