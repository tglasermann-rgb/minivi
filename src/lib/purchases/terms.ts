import { addDays } from "date-fns";

export type PaymentTerms = "contado" | "30" | "30_60" | "30_60_90" | "custom";

export const TERMS_LABELS: Record<PaymentTerms, string> = {
  contado: "Contado (al recibir)",
  "30": "30 días",
  "30_60": "2 cuotas: 30 y 60 días",
  "30_60_90": "3 cuotas: 30, 60 y 90 días",
  custom: "Personalizado",
};

export type Installment = { amountCents: number; dueOn: Date };

/** Reparte `total` en `n` cuotas enteras en centavos; el resto va a la primera. */
export function splitCents(total: number, n: number): number[] {
  if (n < 1) throw new Error("n tiene que ser ≥ 1");
  const base = Math.floor(total / n);
  const rest = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i === 0 ? rest : 0));
}

/**
 * Genera las cuentas por pagar según las condiciones. `from` es la fecha de la compra.
 * - contado: 1 cuota, vence el mismo día.
 * - 30 / 30_60 / 30_60_90: cuotas iguales a 30, 60 y 90 días.
 * - custom: se pasan las cuotas a mano.
 */
export function buildInstallments(totalCents: number, terms: PaymentTerms, from: Date, custom?: Installment[]): Installment[] {
  if (totalCents <= 0) return [];
  switch (terms) {
    case "contado":
      return [{ amountCents: totalCents, dueOn: from }];
    case "30":
      return [{ amountCents: totalCents, dueOn: addDays(from, 30) }];
    case "30_60":
      return splitCents(totalCents, 2).map((a, i) => ({ amountCents: a, dueOn: addDays(from, 30 * (i + 1)) }));
    case "30_60_90":
      return splitCents(totalCents, 3).map((a, i) => ({ amountCents: a, dueOn: addDays(from, 30 * (i + 1)) }));
    case "custom": {
      const list = custom ?? [];
      const sum = list.reduce((s, c) => s + c.amountCents, 0);
      if (sum !== totalCents) throw new Error(`Las cuotas suman ${sum} y el total es ${totalCents}`);
      return list;
    }
  }
}

/** Totales de una compra a partir de sus líneas. */
export function purchaseTotals(items: { qty: number; unitCostCents: number }[], taxCents: number, shippingCents: number) {
  const subtotalCents = items.reduce((s, i) => s + i.qty * i.unitCostCents, 0);
  return { subtotalCents, totalCents: subtotalCents + taxCents + shippingCents };
}
