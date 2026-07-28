-- CreateTable: PayrollControlPeriod
CREATE TABLE IF NOT EXISTS "PayrollControlPeriod" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reopenReason" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollControlPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PayrollControlRecord
CREATE TABLE IF NOT EXISTS "PayrollControlRecord" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "category" TEXT,
    "department" TEXT,
    "gestoriaCode" TEXT,
    "overtimeRate" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "overtimeRateManual" DECIMAL(10,4),
    "isOvertimeRateManual" BOOLEAN NOT NULL DEFAULT false,
    "holidayOvertimeRate" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "holidayOvertimeRateManual" DECIMAL(10,4),
    "isHolidayOvertimeRateManual" BOOLEAN NOT NULL DEFAULT false,
    "overtimeHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "overtimeHoursManual" DECIMAL(10,2),
    "isOvertimeHoursManual" BOOLEAN NOT NULL DEFAULT false,
    "holidayOvertimeHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "holidayOvertimeHoursManual" DECIMAL(10,2),
    "isHolidayOvertimeHoursManual" BOOLEAN NOT NULL DEFAULT false,
    "totalOvertimeAmountCalculated" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalOvertimeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalOvertimeAmountManual" DECIMAL(12,2),
    "isTotalOvertimeAmountManual" BOOLEAN NOT NULL DEFAULT false,
    "positiveVariable" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "positiveVariableManual" DECIMAL(12,2),
    "isPositiveVariableManual" BOOLEAN NOT NULL DEFAULT false,
    "negativeVariable" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "negativeVariableManual" DECIMAL(12,2),
    "isNegativeVariableManual" BOOLEAN NOT NULL DEFAULT false,
    "diets" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dietsManual" DECIMAL(12,2),
    "isDietsManual" BOOLEAN NOT NULL DEFAULT false,
    "irpf" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "irpfManual" DECIMAL(6,4),
    "isIrpfManual" BOOLEAN NOT NULL DEFAULT false,
    "tgss" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "tgssManual" DECIMAL(6,4),
    "isTgssManual" BOOLEAN NOT NULL DEFAULT false,
    "availablePercentageCalculated" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "availablePercentage" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "availablePercentageManual" DECIMAL(6,4),
    "isAvailablePercentageManual" BOOLEAN NOT NULL DEFAULT false,
    "grossCalculated" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gross" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grossManual" DECIMAL(12,2),
    "isGrossManual" BOOLEAN NOT NULL DEFAULT false,
    "productivityCalculated" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "productivity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "productivityManual" DECIMAL(12,2),
    "isProductivityManual" BOOLEAN NOT NULL DEFAULT false,
    "hoursCalculated" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "hoursAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "hoursAmountManual" DECIMAL(12,2),
    "isHoursAmountManual" BOOLEAN NOT NULL DEFAULT false,
    "differenceCalculated" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "difference" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "differenceManual" DECIMAL(12,2),
    "isDifferenceManual" BOOLEAN NOT NULL DEFAULT false,
    "customConcepts" TEXT,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollControlRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PayrollControlOverride
CREATE TABLE IF NOT EXISTS "PayrollControlOverride" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "calculatedValue" TEXT,
    "manualValue" TEXT,
    "previousValue" TEXT,
    "newValue" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollControlOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PayrollControlConceptConfig
CREATE TABLE IF NOT EXISTS "PayrollControlConceptConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "gestoriaCode" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollControlConceptConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollControlPeriod_companyId_year_month_key" ON "PayrollControlPeriod"("companyId", "year", "month");
CREATE INDEX IF NOT EXISTS "PayrollControlPeriod_companyId_idx" ON "PayrollControlPeriod"("companyId");
CREATE INDEX IF NOT EXISTS "PayrollControlPeriod_year_month_idx" ON "PayrollControlPeriod"("year", "month");
CREATE INDEX IF NOT EXISTS "PayrollControlPeriod_status_idx" ON "PayrollControlPeriod"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "PayrollControlRecord_periodId_employeeId_key" ON "PayrollControlRecord"("periodId", "employeeId");
CREATE INDEX IF NOT EXISTS "PayrollControlRecord_periodId_idx" ON "PayrollControlRecord"("periodId");
CREATE INDEX IF NOT EXISTS "PayrollControlRecord_employeeId_idx" ON "PayrollControlRecord"("employeeId");

CREATE INDEX IF NOT EXISTS "PayrollControlOverride_recordId_idx" ON "PayrollControlOverride"("recordId");
CREATE INDEX IF NOT EXISTS "PayrollControlOverride_fieldName_idx" ON "PayrollControlOverride"("fieldName");

CREATE UNIQUE INDEX IF NOT EXISTS "PayrollControlConceptConfig_companyId_key_key" ON "PayrollControlConceptConfig"("companyId", "key");
CREATE INDEX IF NOT EXISTS "PayrollControlConceptConfig_companyId_idx" ON "PayrollControlConceptConfig"("companyId");

-- AddForeignKeys
ALTER TABLE "PayrollControlPeriod" DROP CONSTRAINT IF EXISTS "PayrollControlPeriod_companyId_fkey";
ALTER TABLE "PayrollControlPeriod" ADD CONSTRAINT "PayrollControlPeriod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayrollControlRecord" DROP CONSTRAINT IF EXISTS "PayrollControlRecord_periodId_fkey";
ALTER TABLE "PayrollControlRecord" ADD CONSTRAINT "PayrollControlRecord_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollControlPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayrollControlRecord" DROP CONSTRAINT IF EXISTS "PayrollControlRecord_employeeId_fkey";
ALTER TABLE "PayrollControlRecord" ADD CONSTRAINT "PayrollControlRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollControlOverride" DROP CONSTRAINT IF EXISTS "PayrollControlOverride_recordId_fkey";
ALTER TABLE "PayrollControlOverride" ADD CONSTRAINT "PayrollControlOverride_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "PayrollControlRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
