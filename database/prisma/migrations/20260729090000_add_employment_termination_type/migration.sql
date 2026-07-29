ALTER TABLE "EmploymentPeriod"
ADD COLUMN "endType" TEXT;

CREATE INDEX "EmploymentPeriod_companyId_endDate_endType_idx"
ON "EmploymentPeriod"("companyId", "endDate", "endType");
