/**
 * Cuenta los viajes a la base que hace cada pantalla. En Vercel cada viaje cuesta
 * la latencia de red hasta Supabase, así que este número es el que manda en la
 * velocidad percibida del portal.
 */
import { appendFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const OUT = process.env.TIMING_OUT ?? "/tmp/minivi-pages.txt";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: async () => ({ id: "00000000-0000-0000-0000-000000000001", email: "t@t.t", fullName: null, role: "owner" }),
  requireOwner: async () => ({ id: "00000000-0000-0000-0000-000000000001", email: "t@t.t", fullName: null, role: "owner" }),
}));
vi.mock("@/lib/storage", () => ({
  uploadToBucket: async () => "stored",
  signedUrl: async (_b: string, p: string) => `https://firmado/${p}`,
  supabaseAdmin: () => ({ storage: { from: () => ({ remove: async () => ({ error: null }) }) } }),
  ensureBucket: async () => {},
}));
vi.mock("@/lib/prisma", async () => {
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("@/generated/prisma/client");
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL ?? "" }) });
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

async function count(label: string, fn: () => Promise<unknown>) {
  const { __counter } = (await import("@/lib/prisma")) as unknown as { __counter: { n: number } };
  const before = __counter.n;
  await fn();
  const n = __counter.n - before;
  appendFileSync(OUT, `${label}: ${n} consultas\n`);
  return n;
}

describe.skipIf(!url)("viajes a la base por pantalla", () => {
  it("ninguna pantalla se pasa de un puñado de consultas", { timeout: 180000 }, async () => {
    const { getSettings } = await import("@/lib/settings");
    const { listProducts } = await import("@/app/app/inventario/queries");
    const { listPurchases, listPayables } = await import("@/app/app/inventario/entradas/queries");
    const { listCategories, listExpensesByMonth, expectedRecurring, openingSummary, monthlyMatrix } = await import("@/lib/expenses/service");
    const { previewPeriod, currentPeriod, whoIsIn, listPeriods, payrollByMonth, salesByEmployee } = await import("@/lib/payroll/service");
    const { ranges, summarize } = await import("@/lib/sales/stats");
    const { weeklyUnits } = await import("@/lib/sales/stats");
    const { monthReport, stopRule, stockSnapshot } = await import("@/lib/reports/service");
    const { listDocuments } = await import("@/lib/legal/service");
    const { yearMonthOf } = await import("@/lib/expenses/budget");

    const s = await getSettings();
    const month = yearMonthOf(new Date(), s.tienda_timezone);
    const period = await currentPeriod();

    const inicio = await count("Inicio", async () => {
      await Promise.all([getSettings(), weeklyUnits(6), monthReport(month), stockSnapshot(), stopRule()]);
    });
    const inventario = await count("Inventario", () => listProducts({}));
    const entradas = await count("Entradas", () => listPurchases());
    const cuentas = await count("Cuentas por pagar", () => listPayables("pending"));
    const gastos = await count("Gastos", async () => {
      await Promise.all([listCategories(), listExpensesByMonth(month), expectedRecurring(month)]);
    });
    const apertura = await count("Gastos → Apertura", () => openingSummary());
    const mensual = await count("Gastos → Mensual", () => monthlyMatrix(6));
    const empleados = await count("Empleados", async () => {
      await Promise.all([whoIsIn(), previewPeriod(period)]);
    });
    const nomina = await count("Nómina", async () => {
      await Promise.all([previewPeriod(period), listPeriods(), salesByEmployee(period), payrollByMonth([month])]);
    });
    const ventas = await count("Ventas", async () => {
      const r = await ranges();
      await Promise.all([summarize(r.today), summarize(r.week), summarize(r.month), weeklyUnits(10)]);
    });
    const reportes = await count("Reportes", async () => {
      await Promise.all([monthReport(month), stopRule()]);
    });
    const legal = await count("Legal", () => listDocuments({}));

    // Con la base lejos, cada consulta cuesta ~60 ms: más de 20 por pantalla se nota.
    for (const [nombre, n] of Object.entries({ inicio, inventario, entradas, cuentas, gastos, apertura, mensual, empleados, nomina, ventas, reportes, legal })) {
      expect(n, `${nombre} hace demasiadas consultas`).toBeLessThanOrEqual(20);
    }
  });
});
