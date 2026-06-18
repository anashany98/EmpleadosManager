-- ROLLBACK for migration 20260615000000_add_employee_soft_delete
-- WARNING: This will RESTORE the destructive ON DELETE CASCADE on
-- 12 child tables, and will lose any soft-deleted employee rows if
-- they were hard-deleted in the meantime. ONLY use this for an
-- emergency rollback within minutes of applying the migration.
--
-- Prerequisite: confirm no soft-deleted employees exist (`SELECT
-- COUNT(*) FROM "Employee" WHERE "deletedAt" IS NOT NULL;`) and
-- resolve them BEFORE running this rollback (either restore the
-- soft-deleted rows, or hard-delete them and accept the data loss).

-- Recreate the original ON DELETE CASCADE constraints.
-- These match the names Prisma generated before the migration ran.
ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_employeeId_fkey";
ALTER TABLE "Expense"
    ADD CONSTRAINT "Expense_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_employeeId_fkey";
ALTER TABLE "Document"
    ADD CONSTRAINT "Document_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "MedicalReview" DROP CONSTRAINT IF EXISTS "MedicalReview_employeeId_fkey";
ALTER TABLE "MedicalReview"
    ADD CONSTRAINT "MedicalReview_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "Training" DROP CONSTRAINT IF EXISTS "Training_employeeId_fkey";
ALTER TABLE "Training"
    ADD CONSTRAINT "Training_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Vacation" DROP CONSTRAINT IF EXISTS "Vacation_employeeId_fkey";
ALTER TABLE "Vacation"
    ADD CONSTRAINT "Vacation_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContractExtension" DROP CONSTRAINT IF EXISTS "ContractExtension_employeeId_fkey";
ALTER TABLE "ContractExtension"
    ADD CONSTRAINT "ContractExtension_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "OvertimeEntry" DROP CONSTRAINT IF EXISTS "OvertimeEntry_employeeId_fkey";
ALTER TABLE "OvertimeEntry"
    ADD CONSTRAINT "OvertimeEntry_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeOnboarding" DROP CONSTRAINT IF EXISTS "EmployeeOnboarding_employeeId_fkey";
ALTER TABLE "EmployeeOnboarding"
    ADD CONSTRAINT "EmployeeOnboarding_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "EmployeeProjectWork" DROP CONSTRAINT IF EXISTS "EmployeeProjectWork_employeeId_fkey";
ALTER TABLE "EmployeeProjectWork"
    ADD CONSTRAINT "EmployeeProjectWork_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "ChecklistTask" DROP CONSTRAINT IF EXISTS "ChecklistTask_employeeId_fkey";
ALTER TABLE "ChecklistTask"
    ADD CONSTRAINT "ChecklistTask_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "EmergencyContact" DROP CONSTRAINT IF EXISTS "EmergencyContact_employeeId_fkey";
ALTER TABLE "EmergencyContact"
    ADD CONSTRAINT "EmergencyContact_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeVacationBalance" DROP CONSTRAINT IF EXISTS "EmployeeVacationBalance_employeeId_fkey";
ALTER TABLE "EmployeeVacationBalance"
    ADD CONSTRAINT "EmployeeVacationBalance_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TimeEntry" DROP CONSTRAINT IF EXISTS "TimeEntry_employeeId_fkey";
ALTER TABLE "TimeEntry"
    ADD CONSTRAINT "TimeEntry_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop the soft-delete columns
DROP INDEX IF EXISTS "Employee_deletedAt_idx";
ALTER TABLE "Employee"
    DROP COLUMN IF EXISTS "deletedAt",
    DROP COLUMN IF EXISTS "deletedById",
    DROP COLUMN IF EXISTS "deletionReason";
