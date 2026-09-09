-- CreateEnum
CREATE TYPE "ExpenseGroup" AS ENUM ('opening', 'recurring');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('company_card', 'cash', 'transfer', 'personal_card_tomas', 'personal_card_nissim');

-- CreateEnum
CREATE TYPE "ExpenseFrequency" AS ENUM ('monthly', 'yearly');

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "group" "ExpenseGroup" NOT NULL,
    "budget_group" TEXT,
    "monthly_budget_cents" INTEGER NOT NULL DEFAULT 0,
    "monthly_budget_later_cents" INTEGER,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opening_budgets" (
    "group" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "opening_budgets_pkey" PRIMARY KEY ("group")
);

-- CreateTable
CREATE TABLE "monthly_budgets" (
    "id" UUID NOT NULL,
    "year_month" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "monthly_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "category_id" UUID NOT NULL,
    "vendor" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "frequency" "ExpenseFrequency",
    "notes" TEXT,
    "receipt_path" TEXT,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "reimbursable" BOOLEAN NOT NULL DEFAULT false,
    "reimbursed_on" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_name_key" ON "expense_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_budgets_year_month_category_id_key" ON "monthly_budgets"("year_month", "category_id");

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "expenses_category_id_date_idx" ON "expenses"("category_id", "date");

-- AddForeignKey
ALTER TABLE "monthly_budgets" ADD CONSTRAINT "monthly_budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- MiniVi: RLS sin políticas (acceso solo por Prisma)
ALTER TABLE "expense_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "opening_budgets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "monthly_budgets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;

-- Categorías del plan de negocio
INSERT INTO "expense_categories" ("id", "name", "group", "budget_group", "monthly_budget_cents", "monthly_budget_later_cents", "sort") VALUES
  (gen_random_uuid(), 'Build-out',                    'opening', 'Build-out',               0, NULL, 1),
  (gen_random_uuid(), 'Vitrinas y mobiliario',        'opening', 'Build-out',               0, NULL, 2),
  (gen_random_uuid(), 'Caja fuerte',                  'opening', 'Seguridad',               0, NULL, 3),
  (gen_random_uuid(), 'Alarma y cámaras',             'opening', 'Seguridad',               0, NULL, 4),
  (gen_random_uuid(), 'POS y hardware',               'opening', 'Build-out',               0, NULL, 5),
  (gen_random_uuid(), 'Licencias y legal',            'opening', 'Licencias, seguro y legal', 0, NULL, 6),
  (gen_random_uuid(), 'Seguro (primera prima)',       'opening', 'Licencias, seguro y legal', 0, NULL, 7),
  (gen_random_uuid(), 'Marketing de apertura',        'opening', 'Marketing de apertura',   0, NULL, 8),
  (gen_random_uuid(), 'Página web',                   'opening', 'Web',                     0, NULL, 9),
  (gen_random_uuid(), 'Empaque y material de marca',  'opening', 'Empaque',                 0, NULL, 10),
  (gen_random_uuid(), 'Depósitos',                    'opening', 'Depósitos',               0, NULL, 11),
  (gen_random_uuid(), 'Renta',                        'recurring', NULL, 240000, NULL, 20),
  (gen_random_uuid(), 'Nómina',                       'recurring', NULL, 776700, NULL, 21),
  (gen_random_uuid(), 'Marketing',                    'recurring', NULL, 250000, 450000, 22),
  (gen_random_uuid(), 'Servicios y telecom',          'recurring', NULL, 0, NULL, 23),
  (gen_random_uuid(), 'Seguro',                       'recurring', NULL, 0, NULL, 24),
  (gen_random_uuid(), 'Contador y legal',             'recurring', NULL, 0, NULL, 25),
  (gen_random_uuid(), 'Insumos',                      'recurring', NULL, 0, NULL, 26),
  (gen_random_uuid(), 'Monitoreo de alarma',          'recurring', NULL, 0, NULL, 27),
  (gen_random_uuid(), 'Shopify y apps',               'recurring', NULL, 0, NULL, 28),
  (gen_random_uuid(), 'Envíos',                       'recurring', NULL, 0, NULL, 29),
  (gen_random_uuid(), 'Comisiones de tarjeta',        'recurring', NULL, 0, NULL, 30),
  (gen_random_uuid(), 'Otros',                        'recurring', NULL, 0, NULL, 31)
ON CONFLICT ("name") DO NOTHING;

-- Presupuesto de apertura del plan (centavos)
INSERT INTO "opening_budgets" ("group", "amount_cents") VALUES
  ('Build-out', 3400000),
  ('Seguridad', 2110000),
  ('Marketing de apertura', 1000000),
  ('Licencias, seguro y legal', 800000),
  ('Depósitos', 720000),
  ('Web', 170000),
  ('Empaque', 550000),
  ('Inventario', 7500000)
ON CONFLICT ("group") DO NOTHING;
