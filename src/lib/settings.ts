import "server-only";
import { cache } from "react";
import { prisma } from "./prisma";
import { SETTING_DEFAULTS, type SettingKey, type Settings } from "./settings-defaults";

function parse<K extends SettingKey>(key: K, raw: string | undefined): Settings[K] {
  const def = SETTING_DEFAULTS[key];
  if (raw === undefined) return def as Settings[K];
  if (typeof def === "number") {
    const n = Number(raw);
    return (Number.isFinite(n) ? n : def) as Settings[K];
  }
  return raw as Settings[K];
}

/** Todos los settings tipados, con defaults para claves faltantes. Cacheado por request. */
export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as Settings;
  for (const key of Object.keys(SETTING_DEFAULTS) as SettingKey[]) {
    (out as Record<string, unknown>)[key] = parse(key, map.get(key));
  }
  return out;
});

export async function getSetting<K extends SettingKey>(key: K): Promise<Settings[K]> {
  const settings = await getSettings();
  return settings[key];
}
