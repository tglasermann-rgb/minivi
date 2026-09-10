import "server-only";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { addStockMovement, createProduct } from "@/lib/inventory/service";
import { computeCostCents, costPerGramWithPremium, resolvePriceCents } from "@/lib/inventory/pricing";
import type { ProductType } from "@/generated/prisma/client";

/**
 * Entrada de mercadería: la compra y el alta en inventario son el mismo acto.
 * Se carga la factura del proveedor una sola vez y las piezas quedan en stock.
 *
 * Cada línea es una pieza nueva o la reposición de una que ya está en inventario.
 * El costo sale de gramos × (costo por gramo de la factura + el "+" de esa línea),
 * salvo que se cierre un costo unitario a mano.
 */

/** Una fecha de pago del calendario: cuánto y cuándo. */
export type IntakePayment = { amountCents: number; dueOn: Date };

type CommonLine = {
  qty: number;
  /** el "+" de la línea en centavos por gramo sobre la base de la factura */
  premiumCents: number;
  /** costo unitario cerrado; si viene, manda sobre la cuenta por gramo */
  unitCostCents?: number | null;
};

/** Primera vez que la pieza entra a la tienda: se crea el producto con SKU y precio. */
export type IntakeNewLine = CommonLine & {
  mode: "new";
  title: string;
  type: ProductType;
  subcategory: string;
  extraTags: string[];
  karat: string;
  grams: number;
  descriptionHtml: string;
  optionName?: string | null;
  optionValue?: string | null;
  priceOverride: boolean;
  priceCents?: number | null;
  status?: "draft" | "active";
  notes?: string | null;
};

/**
 * Reposición de una pieza que ya existe. Los gramos son los del producto:
 * si el peso es distinto no es la misma pieza y va como nueva.
 */
export type IntakeRestockLine = CommonLine & {
  mode: "restock";
  productId: string;
  /** true = la pieza vieja pasa al costo de esta factura y se le recalcula el precio */
  updateExisting: boolean;
};

export type IntakeLine = IntakeNewLine | IntakeRestockLine;

export type IntakeInput = {
  supplierId: string;
  date: Date;
  invoiceNumber?: string | null;
  /** base de la factura en centavos por gramo */
  costPerGramCents: number;
  taxCents: number;
  shippingCents: number;
  /** cuándo hay que pagar. Si viene vacío, todo el total en la fecha de la factura. */
  payments: IntakePayment[];
  notes?: string | null;
  lines: IntakeLine[];
};

export type IntakeResult = {
  purchaseId: string;
  number: number;
  totalCents: number;
  created: { sku: string; title: string; qty: number }[];
  restocked: { sku: string; title: string; qty: number; repriced: boolean }[];
};

/** Costo unitario de una línea: el cerrado a mano, o gramos × (base + su "+"). */
export function lineUnitCost(basePerGramCents: number, grams: number, premiumCents: number, unitCostCents?: number | null): number {
  if (unitCostCents != null && unitCostCents >= 0) return unitCostCents;
  return computeCostCents(grams, costPerGramWithPremium(basePerGramCents, premiumCents));
}

/**
 * Reparte el total en las fechas del calendario. Sin fechas, una sola por el total.
 * La suma tiene que dar exactamente el total: si no, la factura queda mal cargada.
 */
export function checkPayments(payments: IntakePayment[], totalCents: number, date: Date): IntakePayment[] {
  if (payments.length === 0) return [{ amountCents: totalCents, dueOn: date }];
  const sum = payments.reduce((s, p) => s + p.amountCents, 0);
  if (sum !== totalCents) {
    throw new Error(`Las fechas de pago suman ${(sum / 100).toFixed(2)} y la factura da ${(totalCents / 100).toFixed(2)}. Tienen que coincidir.`);
  }
  if (payments.some((p) => p.amountCents <= 0)) throw new Error("Cada fecha de pago tiene que tener un monto mayor a cero");
  return payments;
}

export async function registerIntake(input: IntakeInput): Promise<IntakeResult> {
  if (input.lines.length === 0) throw new Error("La entrada necesita al menos una pieza");
  if (!(input.costPerGramCents > 0)) throw new Error("El costo por gramo tiene que ser mayor a cero");
  const user = await getCurrentUser();
  const settings = await getSettings();

  // Los gramos de una reposición son los de la pieza que ya está en inventario.
  const restockIds = input.lines.flatMap((l) => (l.mode === "restock" ? [l.productId] : []));
  const existing = restockIds.length
    ? await prisma.product.findMany({ where: { id: { in: restockIds } } })
    : [];
  const byId = new Map(existing.map((p) => [p.id, p]));
  for (const id of restockIds) if (!byId.has(id)) throw new Error("Una de las piezas a reponer ya no existe en el inventario");

  const lines = input.lines.map((l, i) => {
    const product = l.mode === "restock" ? byId.get(l.productId)! : null;
    const grams = product ? Number(product.grams) : (l as IntakeNewLine).grams;
    if (!(grams > 0)) throw new Error(`La pieza ${i + 1} necesita gramos mayores a cero`);
    if (!Number.isInteger(l.qty) || l.qty < 1) throw new Error(`La pieza ${i + 1} necesita una cantidad mayor a cero`);
    const premiumCents = Math.max(0, Math.round(l.premiumCents ?? 0));
    return {
      line: l,
      product,
      position: i + 1,
      grams,
      premiumCents,
      unitCostCents: lineUnitCost(input.costPerGramCents, grams, premiumCents, l.unitCostCents),
      unitCostOverride: l.unitCostCents != null,
    };
  });

  const subtotalCents = lines.reduce((s, l) => s + l.unitCostCents * l.line.qty, 0);
  const totalCents = subtotalCents + input.taxCents + input.shippingCents;
  const payments = checkPayments(input.payments, totalCents, input.date);

  // La factura primero: es el papel que respalda todo lo que sigue.
  const purchase = await prisma.purchase.create({
    data: {
      supplierId: input.supplierId,
      date: input.date,
      invoiceNumber: input.invoiceNumber ?? null,
      costPerGramCents: input.costPerGramCents,
      taxCents: input.taxCents,
      shippingCents: input.shippingCents,
      subtotalCents,
      totalCents,
      // Las fechas las pone el usuario en el calendario, no una condición fija.
      paymentTerms: "custom",
      status: "received",
      notes: input.notes ?? null,
      createdBy: user?.id ?? null,
      items: {
        create: lines.map((l) => ({
          position: l.position,
          description: l.product ? l.product.title : (l.line as IntakeNewLine).title.trim(),
          type: l.product ? l.product.type : (l.line as IntakeNewLine).type,
          subcategory: l.product ? l.product.subcategory : (l.line as IntakeNewLine).subcategory,
          karat: l.product ? l.product.karat : (l.line as IntakeNewLine).karat,
          grams: l.grams,
          qty: l.line.qty,
          qtyReceived: l.line.qty,
          unitCostCents: l.unitCostCents,
          unitCostOverride: l.unitCostOverride,
          premiumCents: l.premiumCents,
          optionName: l.product ? l.product.optionName : (l.line as IntakeNewLine).optionName || null,
          optionValue: l.product ? l.product.optionValue : (l.line as IntakeNewLine).optionValue || null,
          productId: l.product?.id ?? null,
          createdBy: user?.id ?? null,
        })),
      },
      payables: { create: payments.map((p) => ({ amountCents: p.amountCents, dueOn: p.dueOn, createdBy: user?.id ?? null })) },
    },
    include: { items: { orderBy: { position: "asc" } } },
  });

  const reference = `PO-${purchase.number}`;
  const created: IntakeResult["created"] = [];
  const restocked: IntakeResult["restocked"] = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const item = purchase.items[i];

    if (l.line.mode === "new") {
      const nueva = l.line;
      const product = await createProduct({
        title: nueva.title,
        type: nueva.type,
        subcategory: nueva.subcategory,
        extraTags: nueva.extraTags,
        karat: nueva.karat,
        grams: l.grams,
        descriptionHtml: nueva.descriptionHtml,
        optionName: nueva.optionName,
        optionValue: nueva.optionValue,
        costCents: l.unitCostCents,
        priceOverride: nueva.priceOverride,
        priceCents: nueva.priceCents,
        status: nueva.status ?? "draft",
        notes: nueva.notes,
        purchaseItemId: item.id,
        initialQty: nueva.qty,
        initialReason: "purchase",
        initialReference: reference,
      });
      await prisma.purchaseItem.update({ where: { id: item.id }, data: { productId: product.id } });
      created.push({ sku: product.sku, title: product.title, qty: nueva.qty });
      continue;
    }

    // Reposición: entra el stock y, si se pidió, la pieza vieja toma el costo nuevo.
    const product = l.product!;
    await addStockMovement({ productId: product.id, qty: l.line.qty, reason: "purchase", reference, note: "Reposición" });
    let repriced = false;
    if (l.line.updateExisting) {
      // El precio se recalcula con el precio por gramo de hoy. Si la pieza tiene
      // precio manual, resolvePriceCents devuelve ese mismo: no se pisa a mano.
      const priceCents = resolvePriceCents({
        grams: Number(product.grams),
        priceOverride: product.priceOverride,
        overridePriceCents: product.priceCents,
        pricePerGramCents: settings.precio_por_gramo,
        roundingCents: settings.redondeo_precio,
      });
      if (priceCents !== product.priceCents || l.unitCostCents !== product.costCents) {
        const after = await prisma.product.update({
          where: { id: product.id },
          data: { costCents: l.unitCostCents, priceCents },
        });
        await audit(
          "products",
          product.id,
          { costCents: product.costCents, priceCents: product.priceCents },
          { costCents: after.costCents, priceCents: after.priceCents },
          "reposicion",
        );
        repriced = true;
      }
    }
    restocked.push({ sku: product.sku, title: product.title, qty: l.line.qty, repriced });
  }

  await audit("purchases", purchase.id, null, {
    number: purchase.number,
    totalCents,
    nuevas: created.length,
    reposiciones: restocked.length,
    pagos: payments.length,
  }, "entrada");

  return { purchaseId: purchase.id, number: purchase.number, totalCents, created, restocked };
}

/** Busca piezas del inventario para reponer, por SKU o por título. */
export async function searchProductsForRestock(q: string, take = 20) {
  const term = q.trim();
  const rows = await prisma.product.findMany({
    where: {
      status: { not: "archived" },
      ...(term
        ? { OR: [{ sku: { contains: term, mode: "insensitive" as const } }, { title: { contains: term, mode: "insensitive" as const } }] }
        : {}),
    },
    select: { id: true, sku: true, title: true, grams: true, costCents: true, priceCents: true, priceOverride: true, optionValue: true },
    orderBy: [{ title: "asc" }],
    take,
  });
  return rows.map((r) => ({ ...r, grams: Number(r.grams) }));
}
