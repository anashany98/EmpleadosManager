-- AlterTable
ALTER TABLE "MedicalReview"
  ADD COLUMN "declined"      BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN "declineReason" TEXT;

-- CreateIndex
CREATE INDEX "MedicalReview_employeeId_idx" ON "MedicalReview"("employeeId");
CREATE INDEX "MedicalReview_date_idx"      ON "MedicalReview"("date");
CREATE INDEX "MedicalReview_declined_idx"  ON "MedicalReview"("declined");
