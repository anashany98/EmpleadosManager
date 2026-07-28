-- Los valores históricos de `gestoriaCode` se rellenaban con subcuenta o
-- fragmentos de UUID. No son códigos de la gestoría y no pueden usarse para
-- decidir una fila de plantilla. Se limpian hasta que RRHH confirme el código
-- explícito de cada empleado.
UPDATE "PayrollControlRecord" r
SET "gestoriaCode" = NULL
FROM "Employee" e
WHERE e."id" = r."employeeId"
  AND e."payrollAgencyEmployeeCode" IS NULL;
