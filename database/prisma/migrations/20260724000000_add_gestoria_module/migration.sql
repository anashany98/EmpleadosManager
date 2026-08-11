-- Migration: add_gestoria_module
-- Módulo "Preparación para gestoría" — sustituye el flujo manual de tres
-- Excel (plantilla individual, control general, plantilla de gestoría).
--
-- Diseño basado en conceptos dinámicos (no columnas rígidas): el operador
-- puede crear, renombrar, ocultar, reordenar y eliminar conceptos sin
-- migraciones. Los valores por (fila, concepto) se guardan en una tabla
-- EAV (GestoriaCell) con `numericValue` y `textValue` para soportar
-- tipos mezclados.

-- ===========================================================================
-- 1. Enums
-- ===========================================================================

-- Estados de un periodo de gestoría.
-- OPEN: editable. CLOSED: bloqueado (solo admin/hr pueden reabrir
-- con motivo obligatorio).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GestoriaPeriodStatus') THEN
        CREATE TYPE "GestoriaPeriodStatus" AS ENUM ('OPEN', 'CLOSED');
    END IF;
END $$;

-- Tipos de valor de un concepto. Decimales por defecto: 2.
-- HOURS  → horas (p. ej. "H. EXT", "H.S/D EXT")
-- PRICE  → precio por hora en €/h
-- AMOUNT → importe monetario total
-- PERCENT → porcentaje (IRPF, TGSS, …)
-- BOOLEAN → sí/no (revisado, declarado, …)
-- TEXT   → observaciones, descripciones libres
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GestoriaConceptType') THEN
        CREATE TYPE "GestoriaConceptType" AS ENUM (
            'HOURS',
            'PRICE',
            'AMOUNT',
            'PERCENT',
            'BOOLEAN',
            'TEXT'
        );
    END IF;
END $$;

-- ===========================================================================
-- 2. Tablas
-- ===========================================================================

-- Periodo: (empresa, año, mes) es único. Contiene el mapeo de exportación
-- (conceptCode → cellAddress en la plantilla .xls) y los flags de bloqueo.
CREATE TABLE IF NOT EXISTS "GestoriaPeriod" (
    "id"            TEXT NOT NULL,
    "companyId"     TEXT NOT NULL,
    "year"          INTEGER NOT NULL,
    "month"         INTEGER NOT NULL,
    "status"        "GestoriaPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "exportMapping" JSONB,
    "notes"         TEXT,
    "closedAt"      TIMESTAMP(3),
    "closedById"    TEXT,
    "reopenReason"  TEXT,
    "reopenedAt"    TIMESTAMP(3),
    "reopenedById"  TEXT,
    "createdById"   TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GestoriaPeriod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GestoriaPeriod_companyId_year_month_key"
    ON "GestoriaPeriod"("companyId", "year", "month");
CREATE INDEX IF NOT EXISTS "GestoriaPeriod_companyId_idx" ON "GestoriaPeriod"("companyId");
CREATE INDEX IF NOT EXISTS "GestoriaPeriod_status_idx" ON "GestoriaPeriod"("status");
CREATE INDEX IF NOT EXISTS "GestoriaPeriod_year_month_idx" ON "GestoriaPeriod"("year", "month");

-- Concepto: el "qué" se mide. type/label/code son configurables.
-- isSystem marca los que vienen del Excel original (no borrables).
-- isVisible/order permiten ocultar y reordenar columnas.
CREATE TABLE IF NOT EXISTS "GestoriaConcept" (
    "id"        TEXT NOT NULL,
    "periodId"  TEXT NOT NULL,
    "code"      TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "type"      "GestoriaConceptType" NOT NULL,
    "decimals"  INTEGER NOT NULL DEFAULT 2,
    "isSystem"  BOOLEAN NOT NULL DEFAULT FALSE,
    "isVisible" BOOLEAN NOT NULL DEFAULT TRUE,
    "order"     INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GestoriaConcept_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GestoriaConcept_periodId_fkey"
        FOREIGN KEY ("periodId") REFERENCES "GestoriaPeriod"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS "GestoriaConcept_periodId_code_key"
    ON "GestoriaConcept"("periodId", "code");
CREATE INDEX IF NOT EXISTS "GestoriaConcept_periodId_order_idx"
    ON "GestoriaConcept"("periodId", "order");
CREATE INDEX IF NOT EXISTS "GestoriaConcept_periodId_isVisible_idx"
    ON "GestoriaConcept"("periodId", "isVisible");

-- Fila: una por (periodo, empleado). employeeId es soft-reference
-- (nullable) para que la fila persista aunque el empleado se borre:
-- la fila de la gestoría es un documento histórico.
-- employeeName/department/category son SNAPSHOTS inmutables.
CREATE TABLE IF NOT EXISTS "GestoriaEmployeeRow" (
    "id"           TEXT NOT NULL,
    "periodId"     TEXT NOT NULL,
    "employeeId"   TEXT,
    "employeeName" TEXT NOT NULL,
    "department"   TEXT,
    "category"     TEXT,
    "observations" TEXT,
    "isReviewed"   BOOLEAN NOT NULL DEFAULT FALSE,
    "reviewedAt"   TIMESTAMP(3),
    "reviewedById" TEXT,
    "totalHours"   DECIMAL(10, 2),
    "totalAmount"  DECIMAL(15, 2),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GestoriaEmployeeRow_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GestoriaEmployeeRow_periodId_fkey"
        FOREIGN KEY ("periodId") REFERENCES "GestoriaPeriod"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "GestoriaEmployeeRow_employeeId_fkey"
        FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS "GestoriaEmployeeRow_periodId_employeeId_key"
    ON "GestoriaEmployeeRow"("periodId", "employeeId");
CREATE INDEX IF NOT EXISTS "GestoriaEmployeeRow_periodId_idx" ON "GestoriaEmployeeRow"("periodId");
CREATE INDEX IF NOT EXISTS "GestoriaEmployeeRow_employeeId_idx" ON "GestoriaEmployeeRow"("employeeId");
CREATE INDEX IF NOT EXISTS "GestoriaEmployeeRow_periodId_isReviewed_idx"
    ON "GestoriaEmployeeRow"("periodId", "isReviewed");

-- Celda: tabla EAV (row × concept) → value.
-- numericValue/textValue: validado en service layer según concept.type.
-- sourceType/sourceRefId: marcadores para futura integración con TimeEntry.
CREATE TABLE IF NOT EXISTS "GestoriaCell" (
    "id"           TEXT NOT NULL,
    "rowId"        TEXT NOT NULL,
    "conceptId"    TEXT NOT NULL,
    "numericValue" DECIMAL(15, 4),
    "textValue"    TEXT,
    "sourceType"   TEXT,
    "sourceRefId"  TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GestoriaCell_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GestoriaCell_rowId_fkey"
        FOREIGN KEY ("rowId") REFERENCES "GestoriaEmployeeRow"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "GestoriaCell_conceptId_fkey"
        FOREIGN KEY ("conceptId") REFERENCES "GestoriaConcept"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS "GestoriaCell_rowId_conceptId_key"
    ON "GestoriaCell"("rowId", "conceptId");
CREATE INDEX IF NOT EXISTS "GestoriaCell_rowId_idx" ON "GestoriaCell"("rowId");
CREATE INDEX IF NOT EXISTS "GestoriaCell_conceptId_idx" ON "GestoriaCell"("conceptId");

-- Vista de columnas: personalización por usuario/periodo.
CREATE TABLE IF NOT EXISTS "GestoriaColumnView" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "periodId"       TEXT NOT NULL,
    "viewName"       TEXT NOT NULL,
    "columnOrder"    JSONB NOT NULL,
    "hiddenConcepts" JSONB NOT NULL,
    "isDefault"      BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GestoriaColumnView_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GestoriaColumnView_periodId_fkey"
        FOREIGN KEY ("periodId") REFERENCES "GestoriaPeriod"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS "GestoriaColumnView_userId_periodId_viewName_key"
    ON "GestoriaColumnView"("userId", "periodId", "viewName");
CREATE INDEX IF NOT EXISTS "GestoriaColumnView_userId_idx" ON "GestoriaColumnView"("userId");
CREATE INDEX IF NOT EXISTS "GestoriaColumnView_periodId_idx" ON "GestoriaColumnView"("periodId");

-- Log de exportaciones: auditoría de cada .xls generado.
-- No almacenamos el archivo (se borra tras la descarga); guardamos
-- SHA-256, tamaño y contador de descargas.
CREATE TABLE IF NOT EXISTS "GestoriaExportLog" (
    "id"              TEXT NOT NULL,
    "periodId"        TEXT NOT NULL,
    "generatedById"   TEXT NOT NULL,
    "outputFilename"  TEXT NOT NULL,
    "fileSize"        INTEGER NOT NULL,
    "fileHash"        TEXT NOT NULL,
    "rowCount"        INTEGER NOT NULL,
    "totalAmount"     DECIMAL(15, 2),
    "mappingSnapshot" JSONB NOT NULL,
    "notes"           TEXT,
    "downloadCount"   INTEGER NOT NULL DEFAULT 0,
    "generatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GestoriaExportLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GestoriaExportLog_periodId_fkey"
        FOREIGN KEY ("periodId") REFERENCES "GestoriaPeriod"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "GestoriaExportLog_periodId_idx" ON "GestoriaExportLog"("periodId");
CREATE INDEX IF NOT EXISTS "GestoriaExportLog_generatedById_idx" ON "GestoriaExportLog"("generatedById");
CREATE INDEX IF NOT EXISTS "GestoriaExportLog_generatedAt_idx" ON "GestoriaExportLog"("generatedAt");
