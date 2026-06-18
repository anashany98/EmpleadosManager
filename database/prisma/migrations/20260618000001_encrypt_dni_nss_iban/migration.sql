-- Encrypt-at-rest for PII fields: dni, socialSecurityNumber, iban.
-- These are personal identifiers under GDPR (Art. 4, Art. 32). The application
-- writes ciphertext into the new `*Enc` columns and keeps the plaintext
-- columns available for backwards-compatible reads (ad-hoc SQL, legacy queries).
-- The plaintext is the SOURCE OF TRUTH only inside the application; it is
-- reconstructed by EncryptionService on demand when reading via Prisma.
--
-- A follow-up `scripts/backfill-pii-encryption.ts` script is expected to run
-- AFTER this migration to encrypt any pre-existing PII rows (it reads the
-- legacy plaintext, encrypts it with EncryptionService, writes the ciphertext
-- to the *Enc columns, and then zeroes the plaintext). The script is
-- idempotent: it skips rows where the *Enc column is already populated.
--
-- IMPORTANT: The legacy plaintext columns are NOT dropped in this migration.
-- They remain available so that if decryption fails for any reason, the
-- original values can be recovered (with audit trail). Drop them in a
-- follow-up migration once the encryption backfill is confirmed and
-- operational decryption has been verified.

ALTER TABLE "Employee"
    ADD COLUMN IF NOT EXISTS "dniEnc"                  TEXT,
    ADD COLUMN IF NOT EXISTS "socialSecurityNumberEnc" TEXT,
    ADD COLUMN IF NOT EXISTS "ibanEnc"                 TEXT;

-- No indexes on ciphertext (not useful for range queries).
-- dni uniqueness is enforced on the plaintext column (already @unique in Prisma).
-- A pre-existing duplicate in the plaintext column would already have been
-- blocked at INSERT time, so backfill can proceed safely.

-- Trigger a re-encryption of any pre-existing rows. The
-- `scripts/backfill-pii-encryption.ts` Node script handles the
-- application-layer encryption (AES-256-GCM with the runtime key).