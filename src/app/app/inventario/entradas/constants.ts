export const PURCHASE_STATUS_LABELS = { draft: "Borrador", ordered: "Pedida", received: "Recibida", closed: "Cerrada" } as const;

/**
 * Los "+" más usados. Son dólares por gramo que se suman a la base de la compra:
 * base $95/g con +12 son $107/g. Se puede escribir cualquier otro número.
 */
export const PREMIUM_PRESETS = [0, 8, 10, 12, 20] as const;
