-- Rollback for 20260618000000_add_missing_models_and_fixes
-- Drops all tables and reverts the FK change.
-- WARNING: This is destructive. Ensure a recent backup exists before running.

-- Drop new tables (in reverse FK dependency order)
DROP TABLE IF EXISTS "EmployeeLockAudit" CASCADE;
DROP TABLE IF EXISTS "CalendarEvent" CASCADE;
DROP TABLE IF EXISTS "PDI" CASCADE;
DROP TABLE IF EXISTS "Objective" CASCADE;
DROP TABLE IF EXISTS "PeerReview" CASCADE;
DROP TABLE IF EXISTS "Evaluation" CASCADE;
DROP TABLE IF EXISTS "EvaluationTemplate" CASCADE;
DROP TABLE IF EXISTS "NotificationCategory" CASCADE;
DROP TABLE IF EXISTS "ReportSchedule" CASCADE;
DROP TABLE IF EXISTS "DashboardConfig" CASCADE;
DROP TABLE IF EXISTS "VacationArchive" CASCADE;

-- Revert Employee.managerId FK to NoAction
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_managerId_fkey";
ALTER TABLE "Employee"
    ADD CONSTRAINT "Employee_managerId_fkey"
    FOREIGN KEY ("managerId") REFERENCES "Employee"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Drop new indexes
DROP INDEX IF EXISTS "AuditLog_entityId_idx";
DROP INDEX IF EXISTS "AuditLog_action_idx";