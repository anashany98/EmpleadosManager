ALTER TABLE "HrAlertRule"
ADD COLUMN "emailMode" TEXT NOT NULL DEFAULT 'IMMEDIATE',
ADD COLUMN "emailRecipients" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN "emailIncludeHr" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "emailIncludeManager" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "HrAlertDelivery" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "taskId" TEXT,
    "sourceKey" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrAlertDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HrAlertDelivery_ruleId_sourceKey_recipient_key"
ON "HrAlertDelivery"("ruleId", "sourceKey", "recipient");

CREATE INDEX "HrAlertDelivery_companyId_status_createdAt_idx"
ON "HrAlertDelivery"("companyId", "status", "createdAt");

CREATE INDEX "HrAlertDelivery_taskId_idx"
ON "HrAlertDelivery"("taskId");

ALTER TABLE "HrAlertDelivery"
ADD CONSTRAINT "HrAlertDelivery_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HrAlertDelivery"
ADD CONSTRAINT "HrAlertDelivery_ruleId_fkey"
FOREIGN KEY ("ruleId") REFERENCES "HrAlertRule"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HrAlertDelivery"
ADD CONSTRAINT "HrAlertDelivery_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "HrTask"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
