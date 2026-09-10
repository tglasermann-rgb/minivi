-- CreateTable
CREATE TABLE "cash_targets" (
    "month_index" INTEGER NOT NULL,
    "target_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "cash_targets_pkey" PRIMARY KEY ("month_index")
);


-- MiniVi: RLS sin políticas (acceso solo por Prisma)
ALTER TABLE "cash_targets" ENABLE ROW LEVEL SECURITY;

-- Meses 1 a 12 en 0: se cargan en Reportes → Caja objetivo según el plan.
INSERT INTO "cash_targets" ("month_index", "target_cents")
SELECT m, 0 FROM generate_series(1, 12) AS m
ON CONFLICT ("month_index") DO NOTHING;

INSERT INTO "settings" ("key", "value") VALUES
  ('caja_inicial', '0'),
  ('regla_parada_umbral', '2000000')
ON CONFLICT ("key") DO NOTHING;
