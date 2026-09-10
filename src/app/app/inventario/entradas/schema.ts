import { z } from "zod";
import { EXTRA_TAGS, KARATS, PRODUCT_TYPES, SUBCATEGORIES } from "@/lib/inventory/constants";

/** Texto por defecto de una pieza nueva. Nunca dice "solid gold". */
export const DEFAULT_DESCRIPTION = "<p>Real 14k gold, stamped 14k. No plating.</p>";

export const intakeLineSchema = z
  .object({
    /** "new" = primera vez en la tienda · "restock" = reponer una pieza que ya está */
    mode: z.enum(["new", "restock"]).default("new"),

    // Reposición
    productId: z.string().uuid().optional().or(z.literal("")),
    /** true = la pieza vieja pasa al costo de esta factura y se le recalcula el precio */
    updateExisting: z.boolean().default(true),

    // Pieza nueva
    title: z.string().trim().max(120).optional().or(z.literal("")),
    type: z.enum(PRODUCT_TYPES as [string, ...string[]]).default("necklace"),
    subcategory: z.enum(SUBCATEGORIES).default("chains"),
    extraTags: z.array(z.enum(EXTRA_TAGS)).default([]),
    karat: z.enum(KARATS).default("14k"),
    grams: z.coerce.number().min(0).max(999999.99).optional(),
    descriptionHtml: z.string().max(5000).default(DEFAULT_DESCRIPTION),
    optionName: z.string().trim().max(30).optional().or(z.literal("")),
    optionValue: z.string().trim().max(20).optional().or(z.literal("")),
    priceOverride: z.boolean().default(false),
    price: z.coerce.number().min(0).optional(),
    status: z.enum(["draft", "active"]).default("draft"),

    // Comunes
    qty: z.coerce.number().int().min(1, "≥ 1"),
    /** el "+" de la línea, en dólares por gramo sobre la base de la factura */
    premium: z.coerce.number().min(0, "≥ 0").max(1000, "demasiado alto").default(0),
    unitCost: z.coerce.number().min(0).optional().or(z.nan().transform(() => undefined)),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "restock") {
      if (!v.productId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["productId"], message: "Elegí la pieza que estás reponiendo" });
      return;
    }
    if (!v.title || v.title.trim().length < 3) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["title"], message: "Mínimo 3 caracteres" });
    if (!(Number(v.grams) > 0)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["grams"], message: "> 0" });
    if (v.priceOverride && !(Number(v.price) > 0)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["price"], message: "Ingresá el precio manual" });
  });

export const intakeFormSchema = z.object({
  supplierId: z.string().uuid("Elegí un proveedor"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  invoiceNumber: z.string().trim().max(60).optional().or(z.literal("")),
  costPerGram: z.coerce.number().positive("> 0"),
  tax: z.coerce.number().min(0).default(0),
  shipping: z.coerce.number().min(0).default(0),
  /** cuándo hay que pagar. Vacío = todo el total en la fecha de la factura. */
  payments: z
    .array(z.object({ amount: z.coerce.number().min(0), dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida") }))
    .default([]),
  notes: z.string().max(2000).optional().or(z.literal("")),
  lines: z.array(intakeLineSchema).min(1, "Agregá al menos una pieza"),
});

export type IntakeFormInput = z.input<typeof intakeFormSchema>;
export type IntakeFormValues = z.output<typeof intakeFormSchema>;

export const supplierSchema = z.object({
  name: z.string().trim().min(2).max(120),
  contact: z.string().trim().max(300).optional().or(z.literal("")),
  paymentTerms: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  active: z.boolean().default(true),
});
export type SupplierInput = z.input<typeof supplierSchema>;

export const payPayableSchema = z.object({
  id: z.string().uuid(),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.string().trim().max(60).optional().or(z.literal("")),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});
