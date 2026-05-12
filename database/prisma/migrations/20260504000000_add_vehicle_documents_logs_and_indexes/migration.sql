-- CreateTable: VehicleDocument
CREATE TABLE "VehicleDocument" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: VehicleDocument
CREATE INDEX "VehicleDocument_vehicleId_idx" ON "VehicleDocument"("vehicleId");

-- AddForeignKey: VehicleDocument
ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: VehicleLog
CREATE TABLE "VehicleLog" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mileage" INTEGER,
    "cost" DECIMAL(15,2) DEFAULT 0,
    "workshop" TEXT,
    "severity" TEXT,
    "status" TEXT,
    "nextActionDate" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: VehicleLog
CREATE INDEX "VehicleLog_vehicleId_idx" ON "VehicleLog"("vehicleId");
CREATE INDEX "VehicleLog_eventDate_idx" ON "VehicleLog"("eventDate");
CREATE INDEX "VehicleLog_type_idx" ON "VehicleLog"("type");

-- AddForeignKey: VehicleLog
ALTER TABLE "VehicleLog" ADD CONSTRAINT "VehicleLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex: AuditLog (add missing indexes)
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_targetEmployeeId_idx" ON "AuditLog"("targetEmployeeId");
CREATE INDEX "AuditLog_createdAt_entity_idx" ON "AuditLog"("createdAt", "entity");

-- AlterColumn: EmployeeVacationBalance - change Float to Decimal for day fields
ALTER TABLE "EmployeeVacationBalance" ALTER COLUMN "annualQuotaDays" TYPE DECIMAL(15,2) USING "annualQuotaDays"::DECIMAL(15,2);
ALTER TABLE "EmployeeVacationBalance" ALTER COLUMN "carriedOverDays" TYPE DECIMAL(15,2) USING "carriedOverDays"::DECIMAL(15,2);
ALTER TABLE "EmployeeVacationBalance" ALTER COLUMN "importedUsedDays" TYPE DECIMAL(15,2) USING "importedUsedDays"::DECIMAL(15,2);

-- AlterColumn: Employee salary fields - change from default Decimal to DECIMAL(15,2)
ALTER TABLE "Employee" ALTER COLUMN "annualGrossSalary" TYPE DECIMAL(15,2) USING "annualGrossSalary"::DECIMAL(15,2);
ALTER TABLE "Employee" ALTER COLUMN "monthlyGrossSalary" TYPE DECIMAL(15,2) USING "monthlyGrossSalary"::DECIMAL(15,2);
ALTER TABLE "Employee" ALTER COLUMN "annualTotalSalary" TYPE DECIMAL(15,2) USING "annualTotalSalary"::DECIMAL(15,2);
ALTER TABLE "Employee" ALTER COLUMN "monthlyTotalSalary" TYPE DECIMAL(15,2) USING "monthlyTotalSalary"::DECIMAL(15,2);