import { appendFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const OUT = process.env.TIMING_OUT ?? "/tmp/minivi-timing.txt";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => ({ id: "00000000-0000-0000-0000-000000000001", email: "t@t.t", fullName: null, role: "owner" }) }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("@/generated/prisma/client");
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL ?? "" }) });
  // Contador de consultas: lo que importa en serverless es cuántos viajes a la base hace cada pantalla.
  const counter = { n: 0 };
  const proxied = new Proxy(client, {
    get(target, prop) {
      const v = Reflect.get(target, prop, target);
      if (typeof prop === "string" && !prop.startsWith("$") && v && typeof v === "object") {
        return new Proxy(v, {
          get(m, op) {
            const fn = Reflect.get(m, op, m);
            if (typeof fn === "function") return (...args: unknown[]) => { counter.n++; return (fn as (...a: unknown[]) => unknown).apply(m, args); };
            return fn;
          },
        });
      }
      return typeof v === "function" ? (v as () => unknown).bind(target) : v;
    },
  });
  return { prisma: proxied, __counter: counter, pingDatabase: async () => ({ ok: true as const, ms: 0 }) };
});

async function measure<T>(label: string, fn: () => Promise<T>) {
  const { __counter } = (await import("@/lib/prisma")) as unknown as { __counter: { n: number } };
  const before = __counter.n;
  const t = Date.now();
  const r = await fn();
  const line = `${label}: ${Date.now() - t}ms, ${__counter.n - before} consultas`;
  appendFileSync(OUT, line + "\n");
  return { r, queries: __counter.n - before };
}

describe.skipIf(!url)("consultas de Inicio", () => {
  it("no hace una consulta por mes ni por semana", { timeout: 180000 }, async () => {
    const { prisma } = await import("@/lib/prisma");
    // Peor caso: apertura hace un año, así la regla de parada recorre 12 meses reales.
    await prisma.setting.upsert({ where: { key: "apertura_mes" }, create: { key: "apertura_mes", value: "2025-10" }, update: { value: "2025-10" } });

    const { weeklyUnits } = await import("@/lib/sales/stats");
    const { stopRule, monthReport, stockSnapshot } = await import("@/lib/reports/service");
    const { payrollByMonth } = await import("@/lib/payroll/service");

    const pocasSemanas = await measure("weeklyUnits(6)", () => weeklyUnits(6));
    const muchasSemanas = await measure("weeklyUnits(26)", () => weeklyUnits(26));
    const pocosMeses = await measure("payrollByMonth(2)", () => payrollByMonth(["2026-08", "2026-09"]));
    const muchosMeses = await measure("payrollByMonth(12)", () => payrollByMonth(Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`)));
    const parada = await measure("stopRule (12 meses pasados)", stopRule);
    await measure("monthReport", () => monthReport("2026-09"));
    await measure("stockSnapshot", stockSnapshot);

    // Lo que importa: la cantidad de consultas no crece con el rango.
    expect(muchasSemanas.queries).toBe(pocasSemanas.queries);
    expect(muchosMeses.queries).toBe(pocosMeses.queries);
    // La regla de parada recorre 12 meses con un puñado fijo de consultas (antes, un reporte por mes).
    expect(parada.queries).toBeLessThanOrEqual(8);

    await prisma.setting.update({ where: { key: "apertura_mes" }, data: { value: "2026-10" } });
  });
});
