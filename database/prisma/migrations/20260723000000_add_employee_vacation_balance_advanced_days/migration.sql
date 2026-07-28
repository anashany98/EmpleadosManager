-- AlterTable: añade advancedDays a EmployeeVacationBalance
--
-- IMP-005: El schema.prisma declaraba `advancedDays Decimal @default(0)`
-- pero la migración correspondiente nunca se aplicó. El backend
-- crasheaba con `Invalid prisma.employeeVacationBalance.findMany()
-- invocation` la primera vez que se llamaba al reporte de
-- vacaciones (`/api/reports/vacations`), que ahora usa este campo
-- directamente para calcular el `projectedRemainingDays`.
--
-- IMPORTANTE: columna con default 0 y NOT NULL, así que es segura
-- para tablas con datos existentes — los empleados sin balance
-- histórico empiezan con 0 días adelantados.

ALTER TABLE "EmployeeVacationBalance"
  ADD COLUMN "advancedDays" NUMERIC(65,30) NOT NULL DEFAULT 0;
