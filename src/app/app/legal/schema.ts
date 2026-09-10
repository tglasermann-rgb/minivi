import { z } from "zod";

export const legalSchema = z.object({
  title: z.string().trim().min(2, "Poné un título").max(160),
  category: z.enum(["lease", "insurance", "license", "supplier", "employment", "company", "tax", "bank", "other"]),
  status: z.enum(["draft", "active", "expired", "terminated"]).default("active"),
  counterparty: z.string().trim().max(160).optional().or(z.literal("")),
  reference: z.string().trim().max(80).optional().or(z.literal("")),
  effectiveOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  noticeDays: z.coerce.number().int().min(0).max(365).default(30),
  amount: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
});
export type LegalFormInput = z.input<typeof legalSchema>;
