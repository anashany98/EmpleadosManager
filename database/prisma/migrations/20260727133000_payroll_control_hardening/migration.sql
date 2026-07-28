-- Payroll control hardening: all changes are additive so existing monthly
-- records remain immutable and recoverable.

ALTER TABLE "Employee"
  ADD COLUMN IF NOT EXISTS "payrollAgencyEmployeeCode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Employee_companyId_payrollAgencyEmployeeCode_key"
  ON "Employee"("companyId", "payrollAgencyEmployeeCode");

ALTER TABLE "PayrollControlPeriod"
  ADD COLUMN IF NOT EXISTS "formulaVersion" TEXT NOT NULL DEFAULT '2026-control-v1',
  ADD COLUMN IF NOT EXISTS "exportedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "exportedById" TEXT,
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "PayrollControlRecord"
  ADD COLUMN IF NOT EXISTS "reconciliationCalculated" DECIMAL(12,4) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "PayrollControlConceptValue" (
  "id" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  "conceptConfigId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "gestoriaCode" TEXT,
  "value" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "manualValue" DECIMAL(12,2),
  "isManual" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollControlConceptValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PayrollControlConceptValue_recordId_conceptConfigId_key"
  ON "PayrollControlConceptValue"("recordId", "conceptConfigId");
CREATE INDEX IF NOT EXISTS "PayrollControlConceptValue_recordId_idx"
  ON "PayrollControlConceptValue"("recordId");
CREATE INDEX IF NOT EXISTS "PayrollControlConceptValue_gestoriaCode_idx"
  ON "PayrollControlConceptValue"("gestoriaCode");

CREATE TABLE IF NOT EXISTS "PayrollControlDailyEntry" (
  "id" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "entryAt" TIMESTAMP(3),
  "breakOutAt" TIMESTAMP(3),
  "breakInAt" TIMESTAMP(3),
  "exitAt" TIMESTAMP(3),
  "workedHours" DECIMAL(8,2),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollControlDailyEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PayrollControlDailyEntry_recordId_workDate_key"
  ON "PayrollControlDailyEntry"("recordId", "workDate");
CREATE INDEX IF NOT EXISTS "PayrollControlDailyEntry_recordId_idx"
  ON "PayrollControlDailyEntry"("recordId");

CREATE TABLE IF NOT EXISTS "PayrollControlExport" (
  "id" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "templateHash" TEXT NOT NULL,
  "outputHash" TEXT NOT NULL,
  "content" BYTEA NOT NULL,
  "mappingJson" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollControlExport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PayrollControlExport_periodId_createdAt_idx"
  ON "PayrollControlExport"("periodId", "createdAt");

ALTER TABLE "PayrollControlConceptValue"
  DROP CONSTRAINT IF EXISTS "PayrollControlConceptValue_recordId_fkey",
  ADD CONSTRAINT "PayrollControlConceptValue_recordId_fkey"
    FOREIGN KEY ("recordId") REFERENCES "PayrollControlRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  DROP CONSTRAINT IF EXISTS "PayrollControlConceptValue_conceptConfigId_fkey",
  ADD CONSTRAINT "PayrollControlConceptValue_conceptConfigId_fkey"
    FOREIGN KEY ("conceptConfigId") REFERENCES "PayrollControlConceptConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollControlDailyEntry"
  DROP CONSTRAINT IF EXISTS "PayrollControlDailyEntry_recordId_fkey",
  ADD CONSTRAINT "PayrollControlDailyEntry_recordId_fkey"
    FOREIGN KEY ("recordId") REFERENCES "PayrollControlRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayrollControlExport"
  DROP CONSTRAINT IF EXISTS "PayrollControlExport_periodId_fkey",
  ADD CONSTRAINT "PayrollControlExport_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "PayrollControlPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  DROP CONSTRAINT IF EXISTS "PayrollControlExport_createdById_fkey",
  ADD CONSTRAINT "PayrollControlExport_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
