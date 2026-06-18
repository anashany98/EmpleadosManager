-- FASE 1 Security Fixes
-- 1. Remove face recognition fields from Employee
-- 2. Fix Float to Decimal for financial fields
-- 3. Add IP/UserAgent to AuditLog

-- =============================================
-- 1. Remove facial recognition fields
-- =============================================

-- AlterTable: Remove faceDescriptor and kioskPin from Employee
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "faceDescriptor",
DROP COLUMN IF EXISTS "kioskPin";

-- =============================================
-- 2. Fix Float → Decimal for financial precision
-- =============================================

-- Expense: amount Float → Decimal(15,2)
ALTER TABLE "Expense" ALTER COLUMN "amount" TYPE DECIMAL(15,2) USING "amount"::DECIMAL(15,2);

-- OvertimeEntry: hours Float → Decimal(8,2)
ALTER TABLE "OvertimeEntry" ALTER COLUMN "hours" TYPE DECIMAL(8,2) USING "hours"::DECIMAL(8,2);

-- OvertimeEntry: rate Float → Decimal(10,4)
ALTER TABLE "OvertimeEntry" ALTER COLUMN "rate" TYPE DECIMAL(10,4) USING "rate"::DECIMAL(10,4);

-- OvertimeEntry: total Float → Decimal(15,2)
ALTER TABLE "OvertimeEntry" ALTER COLUMN "total" TYPE DECIMAL(15,2) USING "total"::DECIMAL(15,2);

-- CategoryRate: overtimeRate Float → Decimal(6,4)
ALTER TABLE "CategoryRate" ALTER COLUMN "overtimeRate" TYPE DECIMAL(6,4) USING "overtimeRate"::DECIMAL(6,4);

-- CategoryRate: holidayOvertimeRate Float → Decimal(6,4)
ALTER TABLE "CategoryRate" ALTER COLUMN "holidayOvertimeRate" TYPE DECIMAL(6,4) USING "holidayOvertimeRate"::DECIMAL(6,4);

-- =============================================
-- 3. Add IP/UserAgent to AuditLog
-- =============================================

-- AlterTable: Add ipAddress and userAgent columns to AuditLog
ALTER TABLE "AuditLog" ADD COLUMN "ipAddress" TEXT,
ADD COLUMN "userAgent" TEXT;
