import { z } from "zod";

export const employeeSchema = z.object({
  name: z.string().trim().min(2, "Nombre").max(80),
  pin: z.string().regex(/^\d{4}$/, "4 dígitos").optional().or(z.literal("")),
  hourlyRate: z.coerce.number().positive("Tarifa por hora"),
  hiredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  active: z.coerce.boolean().default(true),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});
export type EmployeeFormInput = z.input<typeof employeeSchema>;

export const entrySchema = z.object({
  employeeId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeIn: z.string().regex(/^\d{2}:\d{2}$/, "Hora de entrada"),
  timeOut: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  breakMinutes: z.coerce.number().int().min(0).max(600).default(0),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});
