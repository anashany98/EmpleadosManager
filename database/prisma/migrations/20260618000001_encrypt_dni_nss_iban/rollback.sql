-- Rollback for 20260618000001_encrypt_dni_nss_iban
-- WARNING: Destructive. The plaintext columns are preserved so rollback is safe,
-- but the *Enc ciphertexts will be lost. Ensure a backup exists.

ALTER TABLE "Employee" DROP COLUMN IF EXISTS "dniEnc";
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "socialSecurityNumberEnc";
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "ibanEnc";