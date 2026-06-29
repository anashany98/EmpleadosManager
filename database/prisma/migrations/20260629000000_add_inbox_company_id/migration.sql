-- AlterTable
ALTER TABLE "InboxDocument" ADD COLUMN "companyId" TEXT;

-- CreateIndex
CREATE INDEX "InboxDocument_companyId_idx" ON "InboxDocument"("companyId");