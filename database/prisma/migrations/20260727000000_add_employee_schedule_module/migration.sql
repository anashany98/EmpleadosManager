-- Migration: add_employee_schedule_module
-- Módulo "Horario" — sustituye el Excel de horario individual por empleado.
-- Una fila por (empleado, día) con horas de entrada/salida, descuento de
-- comida, y observaciones. El backend calcula horas trabajadas / extra /
-- extra-festivo replicando las fórmulas del Excel horario.xlsx.
--
-- Se añade también la tabla `Holiday` para que el cálculo de horas
-- extra en festivo sea correcto a nivel de aplicación (no dependemos
-- de un seed externo). Se siembran los 14 festivos nacionales 2025/2026
-- en el seed siguiente.

-- ============================================================================
-- 1. Tabla EmployeeScheduleEntry
-- ============================================================================
CREATE TABLE "EmployeeScheduleEntry" (
    "id"          TEXT NOT NULL,
    "employeeId"  TEXT NOT NULL,
    "companyId"   TEXT,
    -- Día del horario (medianoche UTC). Una fila por (empleado, día).
    "date"        DATE NOT NULL,
    -- Turno 1 (mañana)
    "entry1"      TIME,
    "exit1"       TIME,
    -- Turno 2 (tarde)
    "entry2"      TIME,
    "exit2"       TIME,
    -- Minutos de descuento (pausa comida) sobre H.LABORABLES.
    "discountMin" INTEGER NOT NULL DEFAULT 0,
    -- Texto libre del empleado / manager
    "notes"       TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- Una sola entrada por (empleado, día).
CREATE UNIQUE INDEX "EmployeeScheduleEntry_employeeId_date_key"
    ON "EmployeeScheduleEntry"("employeeId", "date");

-- Lookups frecuentes (calendario de un empleado, calendario de un mes).
CREATE INDEX "EmployeeScheduleEntry_employeeId_date_idx"
    ON "EmployeeScheduleEntry"("employeeId", "date" DESC);
CREATE INDEX "EmployeeScheduleEntry_companyId_date_idx"
    ON "EmployeeScheduleEntry"("companyId", "date" DESC);

-- ============================================================================
-- 2. Tabla Holiday (festivos)
-- ============================================================================
CREATE TABLE "Holiday" (
    "id"        TEXT NOT NULL,
    -- Día festivo. Sin hora.
    "date"      DATE NOT NULL,
    -- Nombre del festivo (ej. "Navidad", "Día del Trabajo").
    "name"      TEXT NOT NULL,
    -- Ámbito: "NATIONAL" (defecto), "REGIONAL", "COMPANY".
    "scope"     TEXT NOT NULL DEFAULT 'NATIONAL',
    -- Si es regional o de empresa, código de región o companyId.
    "region"    TEXT,
    "companyId" TEXT,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- Una fila por (date, scope, region, companyId) — para soportar múltiples
-- festividades el mismo día (nacional + regional + empresa).
CREATE UNIQUE INDEX "Holiday_date_scope_region_companyId_key"
    ON "Holiday"("date", "scope", "region", "companyId");

-- Lookup por fecha y mes.
CREATE INDEX "Holiday_date_idx" ON "Holiday"("date");

-- ============================================================================
-- 3. Foreign keys
-- ============================================================================
ALTER TABLE "EmployeeScheduleEntry"
    ADD CONSTRAINT "EmployeeScheduleEntry_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "EmployeeScheduleEntry"
    ADD CONSTRAINT "EmployeeScheduleEntry_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "Holiday"
    ADD CONSTRAINT "Holiday_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
