import type { PaymentMethod } from "@/generated/prisma/client";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  company_card: "Tarjeta de empresa",
  cash: "Efectivo",
  transfer: "Transferencia",
  personal_card_tomas: "Tarjeta personal de Tomas",
  personal_card_nissim: "Tarjeta personal de Nissim",
};
