import { z } from "zod";

export const expenseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha"),
  categoryId: z.string().uuid("Elegí una categoría"),
  vendor: z.string().trim().min(1, "Proveedor o comercio").max(120),
  amount: z.coerce.number().positive("Monto"),
  paymentMethod: z.enum(["company_card", "cash", "transfer", "personal_card_tomas", "personal_card_nissim"]),
  recurring: z.coerce.boolean().default(false),
  frequency: z.enum(["monthly", "yearly"]).default("monthly"),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  paid: z.coerce.boolean().default(true),
  reimbursable: z.coerce.boolean().default(false),
});
