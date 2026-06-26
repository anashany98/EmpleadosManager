-- CreateTable
CREATE TABLE "AbsenceTypeConfig" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "icon" TEXT NOT NULL DEFAULT 'calendar',
    "description" TEXT,
    "annualLimitDays" INTEGER,
    "countsForBalance" BOOLEAN NOT NULL DEFAULT false,
    "requiresAttachment" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbsenceTypeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceTypeConfig_code_key" ON "AbsenceTypeConfig"("code");

-- CreateIndex
CREATE INDEX "AbsenceTypeConfig_isActive_idx" ON "AbsenceTypeConfig"("isActive");
