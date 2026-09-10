import { describe, expect, it } from "vitest";
import { daysUntil, expiryLabel, expiryState } from "./expiry";

const hoy = new Date("2026-09-10T15:00:00Z");
const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("vencimientos de documentos legales", () => {
  it("cuenta días completos, sin importar la hora", () => {
    expect(daysUntil(d("2026-09-10"), hoy)).toBe(0);
    expect(daysUntil(d("2026-09-11"), hoy)).toBe(1);
    expect(daysUntil(d("2026-09-01"), hoy)).toBe(-9);
    expect(daysUntil(null, hoy)).toBeNull();
  });

  it("avisa con la anticipación configurada", () => {
    const base = { status: "active" as const, noticeDays: 30 };
    expect(expiryState({ ...base, expiresOn: d("2026-12-31") }, hoy).state).toBe("vigente");
    expect(expiryState({ ...base, expiresOn: d("2026-10-05") }, hoy).state).toBe("por_vencer"); // 25 días
    expect(expiryState({ ...base, expiresOn: d("2026-10-10") }, hoy).state).toBe("por_vencer"); // 30 días, justo el límite
    expect(expiryState({ ...base, expiresOn: d("2026-10-11") }, hoy).state).toBe("vigente"); // 31 días
    expect(expiryState({ ...base, expiresOn: d("2026-09-09") }, hoy).state).toBe("vencido");
    expect(expiryState({ ...base, expiresOn: d("2026-09-10") }, hoy).state).toBe("por_vencer"); // vence hoy
  });

  it("un aviso de 90 días avisa mucho antes; uno de 0 solo el día del vencimiento", () => {
    expect(expiryState({ status: "active", noticeDays: 90, expiresOn: d("2026-11-15") }, hoy).state).toBe("por_vencer");
    expect(expiryState({ status: "active", noticeDays: 0, expiresOn: d("2026-09-11") }, hoy).state).toBe("vigente");
    expect(expiryState({ status: "active", noticeDays: 0, expiresOn: d("2026-09-10") }, hoy).state).toBe("por_vencer");
  });

  it("sin fecha o terminado no vence", () => {
    expect(expiryState({ status: "active", noticeDays: 30, expiresOn: null }, hoy).state).toBe("sin_vencimiento");
    expect(expiryState({ status: "terminated", noticeDays: 30, expiresOn: d("2026-01-01") }, hoy).state).toBe("sin_vencimiento");
  });

  it("texto en español", () => {
    expect(expiryLabel(null)).toBe("sin vencimiento");
    expect(expiryLabel(0)).toBe("vence hoy");
    expect(expiryLabel(1)).toBe("vence en 1 día");
    expect(expiryLabel(25)).toBe("vence en 25 días");
    expect(expiryLabel(-1)).toBe("venció hace 1 día");
    expect(expiryLabel(-9)).toBe("venció hace 9 días");
  });
});
