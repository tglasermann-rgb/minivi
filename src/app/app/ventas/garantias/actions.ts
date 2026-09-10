"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { parseDollarsToCents } from "@/lib/money";

const schema = z.object({
  sku: z.string().trim().min(3).max(30),
  orderNumber: z.string().trim().max(30).optional().or(z.literal("")),
  customerName: z.string().trim().max(120).optional().or(z.literal("")),
  customerContact: z.string().trim().max(200).optional().or(z.literal("")),
  soldOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  reportedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  issue: z.string().trim().min(3).max(1000),
  resolution: z.string().trim().max(1000).optional().or(z.literal("")),
  cost: z.coerce.number().min(0).default(0),
  status: z.enum(["open", "resolved"]).default("open"),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});
export type ClaimInput = z.input<typeof schema>;

export async function saveClaimAction(id: string | null, input: unknown): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const user = await requireOwner();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá los campos: " + parsed.error.issues.map((i) => i.path.join(".")).join(", ") };
  const v = parsed.data;
  try {
    const product = await prisma.product.findUnique({ where: { sku: v.sku.toUpperCase() } });
    const data = {
      productId: product?.id ?? null, sku: v.sku.toUpperCase(), orderNumber: v.orderNumber || null, customerName: v.customerName || null, customerContact: v.customerContact || null,
      soldOn: v.soldOn ? new Date(`${v.soldOn}T00:00:00Z`) : null, reportedOn: new Date(`${v.reportedOn}T00:00:00Z`), issue: v.issue, resolution: v.resolution || null,
      costCents: parseDollarsToCents(v.cost), status: v.status, resolvedOn: v.status === "resolved" ? new Date() : null, notes: v.notes || null,
    };
    if (id) { const before = await prisma.warrantyClaim.findUniqueOrThrow({ where: { id } }); const after = await prisma.warrantyClaim.update({ where: { id }, data }); await audit("warranty_claims", id, { status: before.status, costCents: before.costCents }, { status: after.status, costCents: after.costCents }); }
    else { const c = await prisma.warrantyClaim.create({ data: { ...data, createdBy: user.id } }); await audit("warranty_claims", c.id, null, { sku: c.sku, issue: c.issue }); }
    revalidatePath("/app/ventas/garantias");
    return { ok: true, message: "Garantía guardada" };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}
