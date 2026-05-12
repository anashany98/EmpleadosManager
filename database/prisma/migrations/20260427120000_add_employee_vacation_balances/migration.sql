-- CreateTable
CREATE TABLE "EmployeeVacationBalance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "annualQuotaDays" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "carriedOverDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "importedUsedDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeVacationBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeVacationBalance_employeeId_year_key" ON "EmployeeVacationBalance"("employeeId", "year");

-- CreateIndex
CREATE INDEX "EmployeeVacationBalance_year_idx" ON "EmployeeVacationBalance"("year");

-- AddForeignKey
ALTER TABLE "EmployeeVacationBalance" ADD CONSTRAINT "EmployeeVacationBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
