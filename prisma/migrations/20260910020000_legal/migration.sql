-- CreateEnum
CREATE TYPE "LegalCategory" AS ENUM ('lease', 'insurance', 'license', 'supplier', 'employment', 'company', 'tax', 'bank', 'other');

-- CreateEnum
CREATE TYPE "LegalStatus" AS ENUM ('draft', 'active', 'expired', 'terminated');

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" "LegalCategory" NOT NULL,
    "status" "LegalStatus" NOT NULL DEFAULT 'active',
    "counterparty" TEXT,
    "reference" TEXT,
    "effective_on" DATE,
    "expires_on" DATE,
    "notice_days" INTEGER NOT NULL DEFAULT 30,
    "amount_cents" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_files" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "legal_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legal_documents_category_status_idx" ON "legal_documents"("category", "status");

-- CreateIndex
CREATE INDEX "legal_documents_expires_on_idx" ON "legal_documents"("expires_on");

-- CreateIndex
CREATE INDEX "legal_files_document_id_idx" ON "legal_files"("document_id");

-- AddForeignKey
ALTER TABLE "legal_files" ADD CONSTRAINT "legal_files_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- MiniVi: RLS sin políticas (acceso solo por Prisma)
ALTER TABLE "legal_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "legal_files" ENABLE ROW LEVEL SECURITY;
