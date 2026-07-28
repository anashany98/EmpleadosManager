ALTER TABLE "ObraExpense"
    ADD COLUMN "endDate" TIMESTAMP(3),
    ADD COLUMN "originalAmount" DECIMAL(15,2),
    ADD COLUMN "allocationGroupId" TEXT,
    ADD COLUMN "allocationIndex" INTEGER,
    ADD COLUMN "allocationCount" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "sourceReference" TEXT;

UPDATE "ObraExpense"
SET
    "endDate" = "date",
    "originalAmount" = "amount",
    "sourceReference" = "reference"
WHERE "endDate" IS NULL;

CREATE INDEX "ObraExpense_allocationGroupId_idx"
ON "ObraExpense"("allocationGroupId");
