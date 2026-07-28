-- Backfill the official payroll concepts for all companies that already have
-- a monthly control period. Values start at zero and preserve existing facts.
WITH companies AS (
  SELECT DISTINCT "companyId" FROM "PayrollControlPeriod"
), concepts AS (
  SELECT * FROM (VALUES
    ('ARREARS', 'Atrasos', '044', 10),
    ('COMMISSION', 'Comisión', '048', 20),
    ('PRODUCTIVITY_AMOUNT', 'Productividad', '050', 30),
    ('EXPENSES', 'Gastos', '182', 40),
    ('OVERTIME_AMOUNT', 'Horas extra', '434', 50),
    ('DIETS', 'Dietas', '604', 60),
    ('WEEKLY_ADVANCE', 'Anticipo semanal', '791', 70)
  ) AS t(key, label, gestoria_code, sort_order)
)
INSERT INTO "PayrollControlConceptConfig" ("id", "companyId", "key", "label", "gestoriaCode", "active", "order", "createdAt", "updatedAt")
SELECT 'seed:' || c."companyId" || ':' || x.key, c."companyId", x.key, x.label, x.gestoria_code, true, x.sort_order, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM companies c CROSS JOIN concepts x
ON CONFLICT ("companyId", "key") DO NOTHING;

INSERT INTO "PayrollControlConceptValue" ("id", "recordId", "conceptConfigId", "key", "label", "gestoriaCode", "value", "createdAt", "updatedAt")
SELECT 'seed:' || r."id" || ':' || cfg."id", r."id", cfg."id", cfg."key", cfg."label", cfg."gestoriaCode", 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "PayrollControlRecord" r
JOIN "PayrollControlPeriod" p ON p."id" = r."periodId"
JOIN "PayrollControlConceptConfig" cfg ON cfg."companyId" = p."companyId" AND cfg."active" = true
ON CONFLICT ("recordId", "conceptConfigId") DO NOTHING;

UPDATE "PayrollControlRecord" r
SET "gestoriaCode" = e."payrollAgencyEmployeeCode"
FROM "Employee" e
WHERE e."id" = r."employeeId"
  AND r."gestoriaCode" IS NULL
  AND e."payrollAgencyEmployeeCode" IS NOT NULL;
