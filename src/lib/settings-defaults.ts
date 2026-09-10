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
  /** Ventas (unidades) por semana según el plan. */
  ventas_semana_base: 15,
  ventas_semana_conservador: 12,
  ventas_semana_optimista: 20,
  ventas_semana_cubre_gastos: 9.5,
  ventas_semana_cubre_gastos_y_banco: 11.2,
  /** Caja con la que se abre (centavos): punto de partida de la caja real. */
  caja_inicial: 0,
  /** Regla de parada: rojo si la caja real está más de este monto (centavos) por debajo del objetivo. */
  regla_parada_umbral: 2000000,
  /** Meta de ventas por vendedora por período de nómina (centavos). 0 = sin meta. */
  meta_ventas_periodo: 0,
  /** Pureza del kilataje por defecto para valuar el inventario a spot (14k = 0.585). */
  pureza_14k: 0.585,
  /** Aviso si el spot por gramo de 14k se aleja más de este % del costo por gramo configurado. */
  spot_alerta_pct: 10,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = { -readonly [K in SettingKey]: (typeof SETTING_DEFAULTS)[K] extends number ? number : string };
