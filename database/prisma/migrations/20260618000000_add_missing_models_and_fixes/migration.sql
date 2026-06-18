-- Add 11 models that exist in schema.prisma but were never migrated to the DB.
-- These were likely created via `prisma db push` at some point but the migrations
-- were not committed. This migration is idempotent (CREATE IF NOT EXISTS / CREATE
-- TABLE checks). Includes fix for Employee.managerId FK drift (NoAction → SetNull)
-- and AuditLog.entityId index.

-- ===========================================================================
-- 1. Fix drift: Employee.managerId FK NoAction → SetNull
-- ===========================================================================
-- The init migration created this FK as NO ACTION but schema.prisma says SetNull.
-- When a manager is soft-deleted, subordinates should have managerId=null, not
-- dangle pointing to a deleted row.
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_managerId_fkey";
ALTER TABLE "Employee"
    ADD CONSTRAINT "Employee_managerId_fkey"
    FOREIGN KEY ("managerId") REFERENCES "Employee"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;

-- ===========================================================================
-- 2. VacationArchive (model exists in schema.prisma)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS "VacationArchive" (
    "id"              TEXT NOT NULL,
    "employeeId"      TEXT NOT NULL,
    "startDate"       TIMESTAMP(3) NOT NULL,
    "endDate"         TIMESTAMP(3) NOT NULL,
    "type"            TEXT NOT NULL DEFAULT 'VACATION',
    "absenceType"     "AbsenceType" NOT NULL DEFAULT 'VACATION',
    "days"            INTEGER NOT NULL DEFAULT 0,
    "reason"          TEXT,
    "fileUrl"         TEXT,
    "status"          TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "managerComment"  TEXT,
    "approvedBy"      TEXT,
    "approvedAt"      TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    "archivedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archiveReason"   TEXT,

    CONSTRAINT "VacationArchive_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VacationArchive_employeeId_idx" ON "VacationArchive"("employeeId");
CREATE INDEX IF NOT EXISTS "VacationArchive_archivedAt_idx" ON "VacationArchive"("archivedAt");

-- ===========================================================================
-- 3. DashboardConfig (user customization)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS "DashboardConfig" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "layout"    TEXT NOT NULL,
    "widgets"   TEXT NOT NULL,
    "tab"       TEXT NOT NULL DEFAULT 'overview',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DashboardConfig_userId_key" ON "DashboardConfig"("userId");

-- ===========================================================================
-- 4. ReportSchedule (scheduled reports)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS "ReportSchedule" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "reportType"  TEXT NOT NULL,
    "params"      TEXT NOT NULL,
    "frequency"   TEXT NOT NULL,
    "sendEmail"   BOOLEAN NOT NULL DEFAULT false,
    "recipients"  TEXT NOT NULL,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt"   TIMESTAMP(3),
    "nextRunAt"   TIMESTAMP(3) NOT NULL,
    "companyId"   TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReportSchedule_isActive_nextRunAt_idx" ON "ReportSchedule"("isActive", "nextRunAt");

-- ===========================================================================
-- 5. NotificationCategory (categories for proactive alerts)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS "NotificationCategory" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "delayDays"   INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationCategory_name_key" ON "NotificationCategory"("name");

-- ===========================================================================
-- 6. EvaluationTemplate (performance evaluations)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS "EvaluationTemplate" (
    "id"                TEXT NOT NULL,
    "name"              TEXT NOT NULL,
    "description"       TEXT,
    "type"              TEXT NOT NULL,
    "version"           INTEGER NOT NULL DEFAULT 1,
    "active"            BOOLEAN NOT NULL DEFAULT true,
    "competencies"      JSONB NOT NULL,
    "scaleConfig"       JSONB NOT NULL,
    "selfAssessment"    BOOLEAN NOT NULL DEFAULT true,
    "managerAssessment" BOOLEAN NOT NULL DEFAULT true,
    "peerAssessment"    BOOLEAN NOT NULL DEFAULT false,
    "peerCount"         INTEGER NOT NULL DEFAULT 0,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EvaluationTemplate_type_active_idx" ON "EvaluationTemplate"("type", "active");

-- ===========================================================================
-- 7. Evaluation (individual evaluations)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS "Evaluation" (
    "id"                  TEXT NOT NULL,
    "templateId"          TEXT NOT NULL,
    "employeeId"          TEXT NOT NULL,
    "evaluatorId"         TEXT NOT NULL,
    "periodStart"         TIMESTAMP(3) NOT NULL,
    "periodEnd"           TIMESTAMP(3) NOT NULL,
    "dueDate"             TIMESTAMP(3) NOT NULL,
    "status"              TEXT NOT NULL DEFAULT 'DRAFT',
    "selfSubmittedAt"     TIMESTAMP(3),
    "managerSubmittedAt"  TIMESTAMP(3),
    "acknowledgedAt"      TIMESTAMP(3),
    "selfScores"          JSONB,
    "managerScores"       JSONB,
    "peerScores"          JSONB,
    "finalScore"          DECIMAL(65,30),
    "strengths"           TEXT,
    "improvements"        TEXT,
    "managerComments"     TEXT,
    "calibratedScore"     DECIMAL(65,30),
    "calibratedBy"        TEXT,
    "calibratedAt"        TIMESTAMP(3),
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Evaluation_employeeId_idx" ON "Evaluation"("employeeId");
CREATE INDEX IF NOT EXISTS "Evaluation_evaluatorId_idx" ON "Evaluation"("evaluatorId");
CREATE INDEX IF NOT EXISTS "Evaluation_status_dueDate_idx" ON "Evaluation"("status", "dueDate");

-- FK to EvaluationTemplate (no onDelete: Prisma default is NoAction)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Evaluation_templateId_fkey') THEN
        ALTER TABLE "Evaluation"
            ADD CONSTRAINT "Evaluation_templateId_fkey"
            FOREIGN KEY ("templateId") REFERENCES "EvaluationTemplate"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION;
    END IF;
END $$;

-- ===========================================================================
-- 8. PeerReview (360° evaluations)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS "PeerReview" (
    "id"           TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "reviewerId"   TEXT NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'PENDING',
    "scores"       JSONB,
    "comments"     TEXT,
    "submittedAt"  TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeerReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PeerReview_evaluationId_reviewerId_key" ON "PeerReview"("evaluationId", "reviewerId");
CREATE INDEX IF NOT EXISTS "PeerReview_reviewerId_idx" ON "PeerReview"("reviewerId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PeerReview_evaluationId_fkey') THEN
        ALTER TABLE "PeerReview"
            ADD CONSTRAINT "PeerReview_evaluationId_fkey"
            FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION;
    END IF;
END $$;

-- ===========================================================================
-- 9. Objective (individual objectives)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS "Objective" (
    "id"               TEXT NOT NULL,
    "evaluationId"     TEXT,
    "employeeId"       TEXT NOT NULL,
    "title"            TEXT NOT NULL,
    "description"      TEXT,
    "category"         TEXT,
    "targetValue"      DECIMAL(65,30),
    "actualValue"      DECIMAL(65,30),
    "unit"             TEXT,
    "weight"           DECIMAL(65,30) DEFAULT 1.0,
    "startDate"        TIMESTAMP(3) NOT NULL,
    "dueDate"          TIMESTAMP(3) NOT NULL,
    "completedAt"      TIMESTAMP(3),
    "status"           TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "progress"         INTEGER NOT NULL DEFAULT 0,
    "achievementScore" DECIMAL(65,30),
    "managerComments"  TEXT,
    "parentObjectiveId" TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Objective_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Objective_employeeId_status_idx" ON "Objective"("employeeId", "status");
CREATE INDEX IF NOT EXISTS "Objective_dueDate_idx" ON "Objective"("dueDate");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Objective_evaluationId_fkey') THEN
        ALTER TABLE "Objective"
            ADD CONSTRAINT "Objective_evaluationId_fkey"
            FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Objective_parentObjectiveId_fkey') THEN
        ALTER TABLE "Objective"
            ADD CONSTRAINT "Objective_parentObjectiveId_fkey"
            FOREIGN KEY ("parentObjectiveId") REFERENCES "Objective"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION;
    END IF;
END $$;

-- ===========================================================================
-- 10. PDI (Individual Development Plan)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS "PDI" (
    "id"              TEXT NOT NULL,
    "evaluationId"    TEXT,
    "employeeId"      TEXT NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'DRAFT',
    "startDate"       TIMESTAMP(3) NOT NULL,
    "endDate"         TIMESTAMP(3),
    "goals"           JSONB,
    "skills"          JSONB,
    "training"        JSONB,
    "mentoring"       JSONB,
    "progress"        INTEGER NOT NULL DEFAULT 0,
    "managerComments" TEXT,
    "employeeComments" TEXT,
    "approvedBy"      TEXT,
    "approvedAt"      TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PDI_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PDI_employeeId_status_idx" ON "PDI"("employeeId", "status");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PDI_evaluationId_fkey') THEN
        ALTER TABLE "PDI"
            ADD CONSTRAINT "PDI_evaluationId_fkey"
            FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION;
    END IF;
END $$;

-- ===========================================================================
-- 11. CalendarEvent (calendar events)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS "CalendarEvent" (
    "id"          TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "location"    TEXT,
    "startDate"   TIMESTAMP(3) NOT NULL,
    "endDate"     TIMESTAMP(3) NOT NULL,
    "allDay"      BOOLEAN NOT NULL DEFAULT true,
    "type"        TEXT NOT NULL,
    "color"       TEXT,
    "companyId"   TEXT,
    "createdBy"   TEXT,
    "isPublic"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CalendarEvent_companyId_startDate_idx" ON "CalendarEvent"("companyId", "startDate");
CREATE INDEX IF NOT EXISTS "CalendarEvent_type_idx" ON "CalendarEvent"("type");
CREATE INDEX IF NOT EXISTS "CalendarEvent_startDate_endDate_idx" ON "CalendarEvent"("startDate", "endDate");

-- ===========================================================================
-- 12. EmployeeLockAudit (audit log for employee locks)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS "EmployeeLockAudit" (
    "id"          TEXT NOT NULL,
    "employeeId"  TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "userEmail"   TEXT NOT NULL,
    "userName"    TEXT NOT NULL,
    "action"      TEXT NOT NULL,
    "timestamp"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata"    TEXT,

    CONSTRAINT "EmployeeLockAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmployeeLockAudit_employeeId_idx" ON "EmployeeLockAudit"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeLockAudit_userId_idx" ON "EmployeeLockAudit"("userId");
CREATE INDEX IF NOT EXISTS "EmployeeLockAudit_timestamp_idx" ON "EmployeeLockAudit"("timestamp");

-- ===========================================================================
-- 13. AuditLog.entityId index (was missing)
-- ===========================================================================
CREATE INDEX IF NOT EXISTS "AuditLog_entityId_idx" ON "AuditLog"("entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");