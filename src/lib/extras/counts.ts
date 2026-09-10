import "server-only";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { addStockMovement, getStockMap } from "@/lib/inventory/service";

export async function createCount(note?: string | null) {
  const user = await getCurrentUser();
  const c = await prisma.inventoryCount.create({ data: { note: note ?? null, createdBy: user?.id ?? null } });
  await audit("inventory_counts", c.id, null, { note });
  return c;
}

/** Suma 1 (o `qty`) al SKU escaneado. Devuelve el producto y el total contado. */
export async function scanSku(countId: string, sku: string, qty = 1) {
  const count = await prisma.inventoryCount.findUniqueOrThrow({ where: { id: countId } });
  if (count.status !== "open") throw new Error("El conteo está cerrado");
  const product = await prisma.product.findUnique({ where: { sku: sku.trim().toUpperCase() } });
  if (!product) throw new Error(`SKU ${sku} no existe`);
  const line = await prisma.inventoryCountLine.upsert({
    where: { countId_productId: { countId, productId: product.id } },
    create: { countId, productId: product.id, counted: Math.max(0, qty) },
    update: { counted: { increment: qty } },
  });
  if (line.counted < 0) await prisma.inventoryCountLine.update({ where: { id: line.id }, data: { counted: 0 } });
  return { product: { id: product.id, sku: product.sku, title: product.title }, counted: Math.max(0, line.counted) };
}

export async function setCounted(countId: string, productId: string, counted: number) {
  await prisma.inventoryCountLine.upsert({ where: { countId_productId: { countId, productId } }, create: { countId, productId, counted }, update: { counted } });
}

export type CountDiff = { productId: string; sku: string; title: string; counted: number; expected: number; diff: number; adjusted: boolean };

/** Diferencias contra el sistema: incluye productos con stock que no se contaron (faltantes). */
export async function countDiff(countId: string): Promise<{ status: "open" | "closed"; note: string | null; lines: CountDiff[]; scanned: number }> {
  const count = await prisma.inventoryCount.findUniqueOrThrow({ where: { id: countId }, include: { lines: true } });
  const stockAll = await prisma.stockMovement.groupBy({ by: ["productId"], _sum: { qty: true } });
  const inStock = stockAll.filter((s) => (s._sum.qty ?? 0) > 0).map((s) => s.productId);
  const ids = Array.from(new Set([...count.lines.map((l) => l.productId), ...(count.status === "open" ? inStock : [])]));
  const products = ids.length ? await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, sku: true, title: true } }) : [];
  const stock = await getStockMap(ids);
  const lines: CountDiff[] = products.map((p) => {
    const l = count.lines.find((x) => x.productId === p.id);
    const expected = count.status === "closed" && l?.expected != null ? l.expected : stock.get(p.id) ?? 0;
    const counted = l?.counted ?? 0;
    return { productId: p.id, sku: p.sku, title: p.title, counted, expected, diff: counted - expected, adjusted: l?.adjusted ?? false };
  }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) || a.sku.localeCompare(b.sku));
  return { status: count.status, note: count.note, lines, scanned: count.lines.reduce((s, l) => s + l.counted, 0) };
}

/** Cierra el conteo: congela el stock esperado de cada línea (incluye faltantes con contado 0). */
export async function closeCount(countId: string) {
  const d = await countDiff(countId);
  if (d.status === "closed") return;
  for (const l of d.lines) {
    await prisma.inventoryCountLine.upsert({
      where: { countId_productId: { countId, productId: l.productId } },
      create: { countId, productId: l.productId, counted: l.counted, expected: l.expected },
      update: { expected: l.expected },
    });
  }
  await prisma.inventoryCount.update({ where: { id: countId }, data: { status: "closed", closedAt: new Date() } });
  await audit("inventory_counts", countId, { status: "open" }, { status: "closed", lines: d.lines.length, diffs: d.lines.filter((l) => l.diff !== 0).length }, "close");
}

/** Ajusta el stock del sistema a lo contado, creando movimientos de ajuste. */
export async function applyAdjustments(countId: string, productIds?: string[]) {
  const d = await countDiff(countId);
  if (d.status !== "closed") throw new Error("Cerrá el conteo antes de ajustar");
  let applied = 0;
  for (const l of d.lines) {
    if (l.diff === 0 || l.adjusted) continue;
    if (productIds && !productIds.includes(l.productId)) continue;
    await addStockMovement({ productId: l.productId, qty: l.diff, reason: l.diff < 0 ? "loss" : "adjustment", reference: `count:${countId}`, note: `Conteo físico: contado ${l.counted}, sistema ${l.expected}` });
    await prisma.inventoryCountLine.update({ where: { countId_productId: { countId, productId: l.productId } }, data: { adjusted: true } });
    applied++;
  }
  return applied;
}
