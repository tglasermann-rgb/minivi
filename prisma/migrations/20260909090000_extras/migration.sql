-- CreateEnum
CREATE TYPE "CountStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('open', 'resolved');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "shopify_staff_name" TEXT;

-- CreateTable
CREATE TABLE "inventory_counts" (
    "id" UUID NOT NULL,
    "status" "CountStatus" NOT NULL DEFAULT 'open',
    "note" TEXT,
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "inventory_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_count_lines" (
    "id" UUID NOT NULL,
    "count_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "counted" INTEGER NOT NULL DEFAULT 0,
    "expected" INTEGER,
    "adjusted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "inventory_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_claims" (
    "id" UUID NOT NULL,
    "product_id" UUID,
    "sku" TEXT NOT NULL,
    "order_number" TEXT,
    "customer_name" TEXT,
    "customer_contact" TEXT,
    "sold_on" DATE,
    "reported_on" DATE NOT NULL,
    "issue" TEXT NOT NULL,
    "resolution" TEXT,
    "cost_cents" INTEGER NOT NULL DEFAULT 0,
    "status" "ClaimStatus" NOT NULL DEFAULT 'open',
    "resolved_on" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "warranty_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gold_spot" (
    "date" DATE NOT NULL,
    "usd_per_ounce_cents" INTEGER NOT NULL,
    "usd_per_gram_cents" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "gold_spot_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "backups" (
    "id" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "tables" INTEGER NOT NULL,
    "rows" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_count_lines_count_id_product_id_key" ON "inventory_count_lines"("count_id", "product_id");

-- CreateIndex
CREATE INDEX "warranty_claims_status_reported_on_idx" ON "warranty_claims"("status", "reported_on");

-- AddForeignKey
ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_count_id_fkey" FOREIGN KEY ("count_id") REFERENCES "inventory_counts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- MiniVi: RLS sin políticas (acceso solo por Prisma)
ALTER TABLE "inventory_counts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_count_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warranty_claims" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gold_spot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "backups" ENABLE ROW LEVEL SECURITY;
