-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN "clientRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TimeEntry_clientRequestId_key" ON "TimeEntry"("clientRequestId");
