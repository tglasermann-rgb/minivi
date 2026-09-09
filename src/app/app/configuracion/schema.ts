import { z } from "zod";

/** Schema del formulario de Configuración (valores como los ve el usuario: dólares, no centavos). */
export const settingsFormSchema = z.object({
  precio_por_gramo: z.coerce.number().positive("Tiene que ser mayor a 0").max(100000),
  redondeo_precio: z.coerce.number().positive("Tiene que ser mayor a 0").max(1000),
  costo_por_gramo_default: z.coerce.number().positive("Tiene que ser mayor a 0").max(100000),
  kilataje_default: z.enum(["10k", "14k", "18k"]),
  semana_inicia: z.enum(["monday", "sunday"]),
  overtime_umbral_horas: z.coerce.number().int().min(1).max(80),
  tienda_timezone: z.string().min(1).refine((tz) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Zona horaria inválida (ej. America/New_York)"),
});

export type SettingsFormValues = z.infer<typeof settingsFormSchema>;
