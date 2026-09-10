import { describe, expect, it } from "vitest";
import { computePayroll, entryHours, grossCents } from "./calc";
import { periodFor, weekStartOf, nextPeriod, periodLabel } from "./periods";

const TZ = "America/New_York";
// Helper: entrada en hora local de Miami (EDT en septiembre = UTC-4)
const ny = (day: string, hIn: number, hOut: number, brk = 0) => ({
  employeeId: "ana",
  clockIn: new Date(`${day}T${String(hIn).padStart(2, "0")}:00:00-04:00`),
  clockOut: new Date(`${day}T${String(hOut).padStart(2, "0")}:00:00-04:00`),
  breakMinutes: brk,
});

describe("períodos", () => {
  it("1–15 y 16–fin", () => {
    expect(periodFor("2026-09-03")).toEqual({ start: "2026-09-01", end: "2026-09-15" });
    expect(periodFor("2026-09-16")).toEqual({ start: "2026-09-16", end: "2026-09-30" });
    expect(periodFor("2026-02-20")).toEqual({ start: "2026-02-16", end: "2026-02-28" });
    expect(nextPeriod({ start: "2026-09-16", end: "2026-09-30" })).toEqual({ start: "2026-10-01", end: "2026-10-15" });
    expect(periodLabel({ start: "2026-09-16", end: "2026-09-30" })).toBe("16/09 – 30/09");
  });
  it("semana empieza el lunes", () => {
    expect(weekStartOf("2026-09-13")).toBe("2026-09-07"); // domingo → lunes anterior
    expect(weekStartOf("2026-09-14")).toBe("2026-09-14"); // lunes
    expect(weekStartOf("2026-09-14", "sunday")).toBe("2026-09-13");
  });
});

describe("horas de una entrada", () => {
  it("descuenta el descanso y redondea a 2 decimales", () => {
    expect(entryHours(ny("2026-09-14", 9, 17, 30))).toBe(7.5);
    expect(entryHours({ employeeId: "x", clockIn: new Date(), clockOut: null, breakMinutes: 0 })).toBe(0);
  });
});

describe("nómina", () => {
  const period = { start: "2026-09-01", end: "2026-09-15" }; // 1 sep 2026 es martes

  it("semana normal de 40 h: sin extra", () => {
    // semana 7–13 sep: lunes a viernes 8 h
    const entries = ["07", "08", "09", "10", "11"].map((d) => ny(`2026-09-${d}`, 9, 17));
    expect(computePayroll(entries, { period, timeZone: TZ })).toEqual([{ employeeId: "ana", regularHours: 40, overtimeHours: 0 }]);
  });

  it("semana con 45 h: 40 normales y 5 extra", () => {
    const entries = ["07", "08", "09", "10", "11"].map((d) => ny(`2026-09-${d}`, 8, 17)); // 9 h × 5
    expect(computePayroll(entries, { period, timeZone: TZ })).toEqual([{ employeeId: "ana", regularHours: 40, overtimeHours: 5 }]);
  });

  it("semana partida entre períodos: la extra va al período donde se superan las 40 h", () => {
    // Semana lunes 14 – domingo 20 de septiembre. Período A = 1–15, período B = 16–30.
    const entries = [
      ny("2026-09-14", 9, 17), // lun 8 h (A)
      ny("2026-09-15", 9, 17), // mar 8 h (A)  → 16
      ny("2026-09-16", 9, 17), // mié 8 h (B)  → 24
      ny("2026-09-17", 9, 17), // jue 8 h (B)  → 32
      ny("2026-09-18", 9, 17), // vie 8 h (B)  → 40
      ny("2026-09-19", 10, 16), // sáb 6 h (B) → 46: 6 h extra en B
    ];
    const a = computePayroll(entries, { period: { start: "2026-09-01", end: "2026-09-15" }, timeZone: TZ });
    const b = computePayroll(entries, { period: { start: "2026-09-16", end: "2026-09-30" }, timeZone: TZ });
    expect(a).toEqual([{ employeeId: "ana", regularHours: 16, overtimeHours: 0 }]);
    expect(b).toEqual([{ employeeId: "ana", regularHours: 24, overtimeHours: 6 }]);
  });

  it("semana partida donde las 40 se cruzan dentro de una entrada", () => {
    const entries = [
      ny("2026-09-14", 7, 19), // lun 12 h (A)
      ny("2026-09-15", 7, 19), // mar 12 h (A) → 24
      ny("2026-09-16", 7, 19), // mié 12 h (B) → 36
      ny("2026-09-17", 7, 19), // jue 12 h (B) → 48: 4 normales + 8 extra
    ];
    const a = computePayroll(entries, { period: { start: "2026-09-01", end: "2026-09-15" }, timeZone: TZ });
    const b = computePayroll(entries, { period: { start: "2026-09-16", end: "2026-09-30" }, timeZone: TZ });
    expect(a).toEqual([{ employeeId: "ana", regularHours: 24, overtimeHours: 0 }]);
    expect(b).toEqual([{ employeeId: "ana", regularHours: 16, overtimeHours: 8 }]);
  });

  it("varios empleados, entradas abiertas se ignoran", () => {
    const entries = [
      ...["07", "08", "09", "10", "11", "12"].map((d) => ny(`2026-09-${d}`, 9, 17)), // ana 48 h
      { ...ny("2026-09-08", 9, 13), employeeId: "bea" }, // bea 4 h
      { employeeId: "bea", clockIn: new Date("2026-09-09T13:00:00Z"), clockOut: null, breakMinutes: 0 },
    ];
    const r = computePayroll(entries, { period, timeZone: TZ });
    expect(r.find((x) => x.employeeId === "ana")).toEqual({ employeeId: "ana", regularHours: 40, overtimeHours: 8 });
    expect(r.find((x) => x.employeeId === "bea")).toEqual({ employeeId: "bea", regularHours: 4, overtimeHours: 0 });
  });

  it("bruto: 1.5× la hora extra", () => {
    expect(grossCents(40, 5, 1500)).toBe(40 * 1500 + 5 * 2250);
    expect(grossCents(7.5, 0, 1333)).toBe(9998); // 9997.5 → 9998
  });
});
