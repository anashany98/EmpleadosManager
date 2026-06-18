-- Rollback for 20260611000000_fase1_security_fixes
-- WARNING: Data loss. Re-adds faceDescriptor and kioskPin as nullable JSON/String,
-- and reverts Expense/OvertimeEntry/CategoryRate from Decimal back to Float.

-- ===========================================================================
-- 1. Re-add facial recognition fields (as nullable for safety)
-- ===========================================================================
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "faceDescriptor" JSONB;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "kioskPin" TEXT;

-- ===========================================================================
-- 2. Revert Float ��' Decimal for financial precision
-- ===========================================================================
-- Expense: amount Decimal(15,2) ��' Float (DOUBLE PRECISION)
ALTER TABLE "Expense" ALTER COLUMN "amount" TYPE DOUBLE PRECISION USING "amount"::DOUBLE PRECISION;

-- OvertimeEntry: hours Decimal(8,2) ��' Float
ALTER TABLE "OvertimeEntry" ALTER COLUMN "hours" TYPE DOUBLE PRECISION USING "hours"::DOUBLE PRECISION;

-- OvertimeEntry: rate Decimal(10,4) ��' Float
ALTER TABLE "OvertimeEntry" ALTER COLUMN "rate" TYPE DOUBLE PRECISION USING "rate"::DOUBLE PRECISION;

-- OvertimeEntry: total Decimal(15,2) ��' Float
ALTER TABLE "OvertimeEntry" ALTER COLUMN "total" TYPE DOUBLE PRECISION USING "total"::DOUBLE PRECISION;

-- CategoryRate: overtimeRate Decimal(6,4) ��' Float
ALTER TABLE "CategoryRate" ALTER COLUMN "overtimeRate" TYPE DOUBLE PRECISION USING "overtimeRate"::DOUBLE PRECISION;

-- CategoryRate: holidayOvertimeRate Decimal(6,4) ��' Float
ALTER TABLE "CategoryRate" ALTER COLUMN "holidayOvertimeRate" TYPE DOUBLE PRECISION USING "holidayOvertimeRate"::DOUBLE PRECISION;

-- ===========================================================================
-- 3. Drop ipAddress/userAgent from AuditLog
-- ===========================================================================
ALTER TABLE "AuditLog" DROP COLUMN IF EXISTS "ipAddress";
ALTER TABLE "AuditLog" DROP COLUMN IF EXISTS "userAgent";