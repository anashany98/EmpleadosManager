-- Extend Project for Obras module (hours + expenses accounting per project)
ALTER TABLE "Project" ADD COLUMN "description" TEXT;
ALTER TABLE "Project" ADD COLUMN "clientName" TEXT;
ALTER TABLE "Project" ADD COLUMN "startDate" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "endDate" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "budget" DECIMAL(15,2);
ALTER TABLE "Project" ADD COLUMN "managerId" TEXT;
ALTER TABLE "Project" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "Project_status_idx" ON "Project"("status");
CREATE INDEX "Project_managerId_idx" ON "Project"("managerId");

ALTER TABLE "Project" ADD CONSTRAINT "Project_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable ObraExpense
CREATE TABLE "ObraExpense" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "employeeId" TEXT,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "description" TEXT,
    "vendor" TEXT,
    "reference" TEXT,
    "origin" TEXT,
    "destination" TEXT,
    "receiptUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "importBatchId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObraExpense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ObraExpense_obraId_type_idx" ON "ObraExpense"("obraId", "type");
CREATE INDEX "ObraExpense_obraId_date_idx" ON "ObraExpense"("obraId", "date");
CREATE INDEX "ObraExpense_employeeId_idx" ON "ObraExpense"("employeeId");
CREATE INDEX "ObraExpense_status_idx" ON "ObraExpense"("status");
CREATE INDEX "ObraExpense_importBatchId_idx" ON "ObraExpense"("importBatchId");

ALTER TABLE "ObraExpense" ADD CONSTRAINT "ObraExpense_obraId_fkey"
  FOREIGN KEY ("obraId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ObraExpense" ADD CONSTRAINT "ObraExpense_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ObraExpense" ADD CONSTRAINT "ObraExpense_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- CreateTable ObraImportBatch
CREATE TABLE "ObraImportBatch" (
    "id" TEXT NOT NULL,
    "obraId" TEXT,
    "sourceFilename" TEXT NOT NULL,
    "sourceFileUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "resultSummary" TEXT,
    "mappingRules" TEXT,
    "warnings" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObraImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ObraImportBatch_status_idx" ON "ObraImportBatch"("status");
CREATE INDEX "ObraImportBatch_obraId_idx" ON "ObraImportBatch"("obraId");

ALTER TABLE "ObraImportBatch" ADD CONSTRAINT "ObraImportBatch_obraId_fkey"
  FOREIGN KEY ("obraId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ObraImportBatch" ADD CONSTRAINT "ObraImportBatch_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "ObraExpense" ADD CONSTRAINT "ObraExpense_importBatchId_fkey"
  FOREIGN KEY ("importBatchId") REFERENCES "ObraImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
