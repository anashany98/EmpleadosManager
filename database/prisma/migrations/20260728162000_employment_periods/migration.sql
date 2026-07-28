CREATE TABLE "EmploymentPeriod" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "startReason" TEXT,
  "endReason" TEXT,
  "createdById" TEXT,
  "endedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmploymentPeriod_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EmploymentPeriod"
  ADD CONSTRAINT "EmploymentPeriod_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmploymentPeriod"
  ADD CONSTRAINT "EmploymentPeriod_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "EmploymentPeriod_employeeId_startDate_idx"
  ON "EmploymentPeriod"("employeeId", "startDate");
CREATE INDEX "EmploymentPeriod_companyId_startDate_endDate_idx"
  ON "EmploymentPeriod"("companyId", "startDate", "endDate");
CREATE INDEX "EmploymentPeriod_endDate_idx" ON "EmploymentPeriod"("endDate");

-- Preserve the currently known relationship as the first historical period.
-- Employees without company cannot be represented because periods are tenant
-- scoped; they remain untouched until a company is assigned.
INSERT INTO "EmploymentPeriod" (
  "id", "employeeId", "companyId", "startDate", "endDate",
  "startReason", "endReason", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  e."id",
  e."companyId",
  COALESCE(e."entryDate", e."createdAt"),
  e."exitDate",
  'Migración del historial previo',
  e."lowReason",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Employee" e
WHERE e."companyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "EmploymentPeriod" p WHERE p."employeeId" = e."id"
  );

-- At most one active employment period per employee.
CREATE UNIQUE INDEX "EmploymentPeriod_one_open_per_employee"
  ON "EmploymentPeriod"("employeeId")
  WHERE "endDate" IS NULL;
