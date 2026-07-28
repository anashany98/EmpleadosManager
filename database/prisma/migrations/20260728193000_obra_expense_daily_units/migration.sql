ALTER TABLE "ObraExpense"
ADD COLUMN "unitAmount" DECIMAL(15,2),
ADD COLUMN "unitCount" INTEGER NOT NULL DEFAULT 1;

UPDATE "ObraExpense"
SET "unitAmount" = "amount"
WHERE "type" = 'PER_DIEM'
  AND "unitAmount" IS NULL;
