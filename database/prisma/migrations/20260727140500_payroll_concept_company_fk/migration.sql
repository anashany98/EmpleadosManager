ALTER TABLE "PayrollControlConceptConfig"
  DROP CONSTRAINT IF EXISTS "PayrollControlConceptConfig_companyId_fkey",
  ADD CONSTRAINT "PayrollControlConceptConfig_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
