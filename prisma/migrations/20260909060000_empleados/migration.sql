-- CreateEnum
CREATE TYPE "PayPeriodStatus" AS ENUM ('open', 'closed', 'paid');

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "pin_hash" TEXT NOT NULL,
    "hourly_rate_cents" INTEGER NOT NULL,
    "hired_on" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "clock_in" TIMESTAMPTZ(6) NOT NULL,
    "clock_out" TIMESTAMPTZ(6),
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "edited_by" UUID,
    "note" TEXT,
    "photo_in_path" TEXT,
    "photo_out_path" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_periods" (
    "id" UUID NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "status" "PayPeriodStatus" NOT NULL DEFAULT 'open',
    "closed_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "pay_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_period_lines" (
    "id" UUID NOT NULL,
    "pay_period_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "regular_hours" DECIMAL(6,2) NOT NULL,
    "overtime_hours" DECIMAL(6,2) NOT NULL,
    "rate_cents" INTEGER NOT NULL,
    "gross_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "pay_period_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_entries_employee_id_clock_in_idx" ON "time_entries"("employee_id", "clock_in");

-- CreateIndex
CREATE INDEX "time_entries_clock_in_idx" ON "time_entries"("clock_in");

-- CreateIndex
CREATE UNIQUE INDEX "pay_periods_starts_on_ends_on_key" ON "pay_periods"("starts_on", "ends_on");

-- CreateIndex
CREATE UNIQUE INDEX "pay_period_lines_pay_period_id_employee_id_key" ON "pay_period_lines"("pay_period_id", "employee_id");

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_period_lines" ADD CONSTRAINT "pay_period_lines_pay_period_id_fkey" FOREIGN KEY ("pay_period_id") REFERENCES "pay_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_period_lines" ADD CONSTRAINT "pay_period_lines_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- MiniVi: RLS sin políticas (acceso solo por Prisma)
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "time_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pay_periods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pay_period_lines" ENABLE ROW LEVEL SECURITY;
