-- ROLLBACK for migration 20260615000001_encrypt_salary_fields
-- Drops the *Enc columns. Any encrypted salary data is LOST (the
-- plaintext was zeroed in the migration, so the legacy Decimal
-- columns are already 0). Restoring requires the original plaintext,
-- which is only available if you have an external backup that
-- pre-dates the encryption migration.

ALTER TABLE "Employee"
    DROP COLUMN IF EXISTS "annualGrossSalaryEnc",
    DROP COLUMN IF EXISTS "monthlyGrossSalaryEnc",
    DROP COLUMN IF EXISTS "annualTotalSalaryEnc",
    DROP COLUMN IF EXISTS "monthlyTotalSalaryEnc";
