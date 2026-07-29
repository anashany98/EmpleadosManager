-- PR5: campo gestoriaCode en GestoriaConcept.
-- Permite mapear un concepto a un codigo de la plantilla .xls de gestoria
-- (p. ej. "044", "048", "050", "182", "434", "604", "791") sin que el
-- operador tenga que recordar direcciones de celda. El backend
-- auto-deriva la columna a partir de este codigo.
ALTER TABLE "GestoriaConcept" ADD COLUMN "gestoriaCode" TEXT;

-- Indice opcional para acelerar filtros por gestoriaCode (no unico
-- porque varios conceptos podrian teoricamente compartir el mismo
-- codigo si el operador se equivoca; la validacion es de runtime
-- en el export, no de schema).
CREATE INDEX "GestoriaConcept_periodId_gestoriaCode_idx"
  ON "GestoriaConcept"("periodId", "gestoriaCode");
