import { z } from "zod";
import { EXTRA_TAGS, KARATS, PRODUCT_TYPES, SUBCATEGORIES } from "@/lib/inventory/constants";

export const productFormSchema = z
  .object({
    title: z.string().trim().min(3, "Mínimo 3 caracteres").max(120),
    type: z.enum(PRODUCT_TYPES as [string, ...string[]]),
    subcategory: z.enum(SUBCATEGORIES),
    extraTags: z.array(z.enum(EXTRA_TAGS)).default([]),
    karat: z.enum(KARATS),
    grams: z.coerce.number().positive("Tiene que ser mayor a 0").max(999999.99),
    descriptionHtml: z.string().max(5000).default(""),
    optionValue: z.string().trim().max(20).optional().or(z.literal("")),
    optionName: z.string().trim().max(30).optional().or(z.literal("")),
    variantOfId: z.string().uuid().optional().or(z.literal("")),
    costMode: z.enum(["perGram", "total"]).default("perGram"),
    costPerGram: z.coerce.number().min(0).optional(),
    costTotal: z.coerce.number().min(0).optional(),
    priceOverride: z.boolean().default(false),
    price: z.coerce.number().min(0).optional(),
    status: z.enum(["draft", "active", "archived"]).default("draft"),
    notes: z.string().max(2000).optional().or(z.literal("")),
    initialQty: z.coerce.number().int().min(0).max(9999).default(0),
  })
  .refine((v) => !v.priceOverride || (v.price != null && v.price > 0), { path: ["price"], message: "Ingresá el precio manual" });

export type ProductFormValues = z.output<typeof productFormSchema>;
export type ProductFormInput = z.input<typeof productFormSchema>;

export const adjustStockSchema = z.object({
  productId: z.string().uuid(),
  qty: z.coerce.number().int().refine((n) => n !== 0, "La cantidad no puede ser 0"),
  reason: z.enum(["purchase", "sale", "return", "adjustment", "loss", "transfer"]),
  reference: z.string().trim().max(120).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});
export type AdjustStockValues = z.infer<typeof adjustStockSchema>;
