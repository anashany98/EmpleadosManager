-- IMP-003: enums en schema para ReportSchedule.
--
-- `reportType` y `frequency` eran `String` en el modelo, lo que
-- permite cualquier valor: typos del frontend ("montly"),
-- valores legacy ("attendanceSummary" vs "attendance-summary"),
-- valores nuevos que el backend no entiende. Un schedule con
-- `reportType='typo'` se creaba sin error y luego reventaba en
-- runtime al ejecutar el cron (switch default -> 500).
--
-- Solución: dos ENUMs PostgreSQL con valores canónicos.
-- Antes del cambio de tipo, hacemos un backfill defensivo:
-- - `reportType` legacy (lowercase + guiones, p.ej. "attendance",
--   "attendance-summary", "genderGap") se mapea al valor enum
--   correspondiente. Cualquier valor inesperado cae a CUSTOM
--   para no perder filas (preferible a fallar la migración).
-- - `frequency` ya estaba en mayúsculas; cualquier valor
--   inesperado cae a DAILY.
--
-- Patrón de 4 pasos: añadir columnas nuevas tipadas -> backfill
-- -> drop columnas viejas -> rename. Garantiza que la tabla
-- siempre tiene valores válidos, sin ventana de "ningún valor".

-- Paso 1: crear los tipos enum
CREATE TYPE "ScheduleReportType" AS ENUM (
  'ATTENDANCE',
  'ATTENDANCE_SUMMARY',
  'OVERTIME',
  'VACATION',
  'COSTS',
  'ABSENCES',
  'ABSENCES_DETAILED',
  'KPIS',
  'GENDER_GAP',
  'CUSTOM'
);

CREATE TYPE "ScheduleFrequency" AS ENUM (
  'DAILY',
  'WEEKLY',
  'MONTHLY'
);

-- Paso 2: añadir columnas nuevas (temporales, NULL permitido
-- durante el backfill)
ALTER TABLE "ReportSchedule" ADD COLUMN "reportTypeNew" "ScheduleReportType";
ALTER TABLE "ReportSchedule" ADD COLUMN "frequencyNew" "ScheduleFrequency";

-- Paso 3: backfill. CASE mapea cada valor string conocido al
-- valor enum. ELSE cae a CUSTOM / DAILY para no perder datos.
-- Esto significa que un schedule con typo en la BD actual
-- sobrevivirá pero acabará marcado como CUSTOM / DAILY, lo
-- cual el operador podrá detectar y corregir manualmente.
UPDATE "ReportSchedule" SET
  "reportTypeNew" = CASE "reportType"
    WHEN 'attendance'         THEN 'ATTENDANCE'::"ScheduleReportType"
    WHEN 'attendance-summary' THEN 'ATTENDANCE_SUMMARY'::"ScheduleReportType"
    WHEN 'overtime'           THEN 'OVERTIME'::"ScheduleReportType"
    WHEN 'vacation'           THEN 'VACATION'::"ScheduleReportType"
    WHEN 'vacations'          THEN 'VACATION'::"ScheduleReportType"
    WHEN 'costs'              THEN 'COSTS'::"ScheduleReportType"
    WHEN 'absences'           THEN 'ABSENCES'::"ScheduleReportType"
    WHEN 'absences-detailed'  THEN 'ABSENCES_DETAILED'::"ScheduleReportType"
    WHEN 'kpis'               THEN 'KPIS'::"ScheduleReportType"
    WHEN 'gender-gap'         THEN 'GENDER_GAP'::"ScheduleReportType"
    WHEN 'genderGap'          THEN 'GENDER_GAP'::"ScheduleReportType"
    WHEN 'custom'             THEN 'CUSTOM'::"ScheduleReportType"
    ELSE 'CUSTOM'::"ScheduleReportType"
  END,
  "frequencyNew" = CASE "frequency"
    WHEN 'DAILY'   THEN 'DAILY'::"ScheduleFrequency"
    WHEN 'WEEKLY'  THEN 'WEEKLY'::"ScheduleFrequency"
    WHEN 'MONTHLY' THEN 'MONTHLY'::"ScheduleFrequency"
    ELSE 'DAILY'::"ScheduleFrequency"
  END;

-- Paso 4: drop + rename + set NOT NULL
ALTER TABLE "ReportSchedule" DROP COLUMN "reportType";
ALTER TABLE "ReportSchedule" DROP COLUMN "frequency";
ALTER TABLE "ReportSchedule" RENAME COLUMN "reportTypeNew" TO "reportType";
ALTER TABLE "ReportSchedule" RENAME COLUMN "frequencyNew" TO "frequency";
ALTER TABLE "ReportSchedule" ALTER COLUMN "reportType" SET NOT NULL;
ALTER TABLE "ReportSchedule" ALTER COLUMN "frequency" SET NOT NULL;
