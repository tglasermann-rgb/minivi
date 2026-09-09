import { z } from "zod";
import { KARATS, PRODUCT_TYPES, SUBCATEGORIES } from "@/lib/inventory/constants";

export const purchaseLineSchema = z.object({
  description: z.string().trim().min(2, "Descripción").max(120),
  type: z.enum(PRODUCT_TYPES as [string, ...string[]]),
  subcategory: z.enum(SUBCATEGORIES),
  karat: z.enum(KARATS),
  grams: z.coerce.number().positive("> 0"),
  qty: z.coerce.number().int().min(1, "≥ 1"),
  unitCost: z.coerce.number().min(0).optional().or(z.nan().transform(() => undefined)),
  optionName: z.string().trim().max(30).optional().or(z.literal("")),
  optionValue: z.string().trim().max(20).optional().or(z.literal("")),
});

export const purchaseFormSchema = z.object({
  supplierId: z.string().uuid("Elegí un proveedor"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  invoiceNumber: z.string().trim().max(60).optional().or(z.literal("")),
  costPerGram: z.coerce.number().positive("> 0"),
  tax: z.coerce.number().min(0).default(0),
  shipping: z.coerce.number().min(0).default(0),
  paymentTerms: z.enum(["contado", "30", "30_60", "30_60_90", "custom"]),
  customInstallments: z.array(z.object({ amount: z.coerce.number().min(0), dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).default([]),
  notes: z.string().max(2000).optional().or(z.literal("")),
  items: z.array(purchaseLineSchema).min(1, "Agregá al menos una línea"),
});
export type PurchaseFormInput = z.input<typeof purchaseFormSchema>;
export type PurchaseFormValues = z.output<typeof purchaseFormSchema>;

export const supplierSchema = z.object({
  name: z.string().trim().min(2).max(120),
  contact: z.string().trim().max(300).optional().or(z.literal("")),
  paymentTerms: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  active: z.boolean().default(true),
});
export type SupplierInput = z.input<typeof supplierSchema>;

export const receiveSchema = z.object({
  purchaseId: z.string().uuid(),
  lines: z.array(z.object({ itemId: z.string().uuid(), qty: z.coerce.number().int().min(0) })),
});

export const payPayableSchema = z.object({
  id: z.string().uuid(),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.string().trim().max(60).optional().or(z.literal("")),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});
