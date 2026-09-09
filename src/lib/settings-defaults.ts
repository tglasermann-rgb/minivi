/**
 * Valores por defecto de la tabla `settings`.
 * Dinero en centavos. Se usan como fallback si falta la fila en la base.
 */
export const SETTING_DEFAULTS = {
  precio_por_gramo: 30000,
  redondeo_precio: 500,
  costo_por_gramo_default: 10000,
  kilataje_default: "14k",
  semana_inicia: "monday",
  overtime_umbral_horas: 40,
  tienda_timezone: "America/New_York",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = { -readonly [K in SettingKey]: (typeof SETTING_DEFAULTS)[K] extends number ? number : string };
