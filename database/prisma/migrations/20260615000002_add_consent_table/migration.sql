-- GDPR consent table. Captures explicit, granular consent for
-- processing activities that go beyond the employment contract
-- (e.g. medical data, biometric data, marketing).
--
-- The `purpose` column is free-text by design to allow new consent
-- categories without a schema change, but the application layer
-- should restrict it to a known set (see ConsentService.ts).
--
-- A withdrawal (`granted = false`) is a positive act and must be
-- recorded with `withdrawnAt` for the audit trail required by
-- GDPR Art. 7(1).

CREATE TABLE "Consent" (
    "id"            TEXT NOT NULL,
    "employeeId"    TEXT NOT NULL,
    "purpose"       TEXT NOT NULL,
    "granted"       BOOLEAN NOT NULL,
    "grantedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt"   TIMESTAMP(3),
    "ipAddress"     TEXT,
    "userAgent"     TEXT,
    "legalBasis"    TEXT NOT NULL DEFAULT 'CONSENT',
    "policyVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "notes"         TEXT,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- Index by employee for the most common access pattern
-- (`/api/me/consents`, GDPR Art. 15 right of access).
CREATE INDEX "Consent_employeeId_idx" ON "Consent"("employeeId");

-- Composite (purpose, granted) for "is this consent still active?"
-- queries without scanning the whole employee history.
CREATE INDEX "Consent_purpose_granted_idx" ON "Consent"("purpose", "granted");

-- Index by grantedAt for retention-purge queries (e.g. delete
-- records older than 7 years for compliance with local statutes).
CREATE INDEX "Consent_grantedAt_idx" ON "Consent"("grantedAt");

-- FK to Employee. CASCADE on delete so that if an employee is hard-
-- deleted (post-retention), their consent records do not orphan.
ALTER TABLE "Consent"
    ADD CONSTRAINT "Consent_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
