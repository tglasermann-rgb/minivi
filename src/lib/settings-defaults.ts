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
  /** ID de la carpeta raíz de Google Drive con las fotos (docs/SETUP-DRIVE.md). */
  drive_root_folder_id: "",
  /** gid://shopify/Location/… de la tienda física (docs/SETUP-SHOPIFY.md). */
  shopify_location_id: "",
  /** Mes de apertura de la tienda (YYYY-MM). Marca el mes 1 del plan para presupuestos y caja objetivo. */
  apertura_mes: "2026-10",
  /** "si" para sacar una foto con la cámara de la tablet al fichar. */
  kiosk_foto: "no",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = { -readonly [K in SettingKey]: (typeof SETTING_DEFAULTS)[K] extends number ? number : string };
