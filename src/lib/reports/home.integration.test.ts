/** Smoke test: las consultas de Inicio y Reportes corren contra Postgres real sin explotar. */
import { describe, expect, it, vi } from "vitest";
const url = process.env.TEST_DATABASE_URL;
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => ({ id: "00000000-0000-0000-0000-000000000001", email: "test@minivi.test", fullName: null, role: "owner" }) }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("@/generated/prisma/client");
  return { prisma: new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL ?? "" }) }) };
});

describe.skipIf(!url)("inicio y reportes (integración)", () => {
  it("todas las consultas de Inicio responden", { timeout: 60000 }, async () => {
    const { getSettings } = await import("@/lib/settings");
    const s = await getSettings();
    expect(s.tienda_timezone).toBeTruthy();
    const { upcomingPayables } = await import("@/lib/purchases/service");
    const { whoIsIn } = await import("@/lib/payroll/service");
    const { weeklyUnits, ranges, summarize } = await import("@/lib/sales/stats");
    const { monthReport, stockSnapshot, stopRule } = await import("@/lib/reports/service");
    const { yearMonthOf } = await import("@/lib/expenses/budget");
    const { metalValuation } = await import("@/lib/extras/gold");
    await upcomingPayables(7);
    await whoIsIn();
    const w = await weeklyUnits(6);
    expect(w.weeks).toHaveLength(6);
    const r = await ranges();
    await summarize(r.week);
    const month = yearMonthOf(new Date(), s.tienda_timezone);
    const rep = await monthReport(month);
    expect(rep.month).toBe(month);
    await stockSnapshot();
    const rule = await stopRule();
    expect(rule.rows).toHaveLength(12);
    await metalValuation();
  });
});
