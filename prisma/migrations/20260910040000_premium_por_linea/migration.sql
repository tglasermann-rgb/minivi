-- El "+" por línea: dólares por gramo que se suman al costo por gramo de la compra.
-- En una misma compra una pulsera puede ir a +10 y otra a +12.
-- Las líneas ya cargadas quedan en 0, que es exactamente lo que valían antes.
ALTER TABLE "purchase_items" ADD COLUMN "premium_cents" INTEGER NOT NULL DEFAULT 0;
