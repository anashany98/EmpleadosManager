-- Encrypt-at-rest for salary fields. The application writes the
-- ciphertext into the new `*Enc` columns and keeps the legacy `Decimal`
-- columns at 0. The plaintext is reconstructed by the
-- EncryptionService on demand.
--
-- A follow-up `scripts/backfill-salary-encryption.ts` script is
-- expected to run AFTER this migration to encrypt any pre-existing
-- salary rows (it reads the legacy Decimal, encrypts it with
-- EncryptionService, writes the ciphertext to the *Enc columns, and
-- then zeroes the Decimal). The script is idempotent.
--
-- IMPORTANT: The legacy `Decimal` columns are NOT dropped in this
-- migration. They remain available for ad-hoc SQL queries (e.g.
-- `SELECT SUM(monthlyGrossSalary) FROM "Employee" WHERE active = true`)
-- but they are no longer authoritative. Drop them in a follow-up
-- migration once the encryption backfill is confirmed.

ALTER TABLE "Employee"
    ADD COLUMN "annualGrossSalaryEnc"   TEXT,
    ADD COLUMN "monthlyGrossSalaryEnc"  TEXT,
    ADD COLUMN "annualTotalSalaryEnc"   TEXT,
    ADD COLUMN "monthlyTotalSalaryEnc"  TEXT;

-- No index: ciphertext is not a usable range key. If you need to
-- filter by salary range, build a (plaintext) bucket column such as
-- `salaryBand` populated by a trigger or background job.

-- Trigger a re-encryption of any pre-existing rows. The
-- `scripts/backfill-salary-encryption.ts` Node script handles the
-- application-layer encryption (AES-256-GCM with the runtime key).
-- No SQL-level work is possible because the key is not available in
-- the database context.
