-- Add AnomalyEvent table
CREATE TABLE "AnomalyEvent" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "employeeId" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "reasons" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnomalyEvent_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "AnomalyEvent_entityType_entityId_key" ON "AnomalyEvent"("entityType", "entityId");
CREATE INDEX "AnomalyEvent_status_idx" ON "AnomalyEvent"("status");
CREATE INDEX "AnomalyEvent_employeeId_idx" ON "AnomalyEvent"("employeeId");

-- Foreign key
ALTER TABLE "AnomalyEvent" ADD CONSTRAINT "AnomalyEvent_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop deprecated columns (kept in initial migration)
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "emergencyContactName";
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "emergencyContactPhone";
