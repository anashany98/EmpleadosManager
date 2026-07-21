-- MED-010: deduplicación de importes de Obras tenía carrera entre
-- lotes concurrentes — el controller leía referencias existentes
-- fuera de la transacción y luego insertaba, sin constraint único.
-- Dos commits paralelos veían `existingSet` vacío y creaban ambos
-- el mismo gasto (gasto duplicado / contabilidad inflada).
--
-- Solución: índice único parcial sobre (obraId, reference) +
-- cleanup de duplicados preexistentes (mantener el más antiguo).
-- En PostgreSQL, los NULL son distintos en UNIQUE, así que varias
-- filas con `reference IS NULL` siguen siendo válidas.

-- Paso 1: cleanup. Mantener la fila más antigua por (obraId,
-- reference) y borrar el resto. Solo se actúa sobre referencias
-- no nulas (las NULL no pueden chocar con el índice único de
-- todas formas). La subquery `older` referencia la fila más
-- antigua que tiene el mismo (obraId, reference) y un
-- createdAt estrictamente menor. Si hay empate de createdAt, la
-- comparación por `id` desempata de forma estable.
DELETE FROM "ObraExpense" e
USING "ObraExpense" older
WHERE e."obraId" = older."obraId"
  AND e."reference" = older."reference"
  AND e."reference" IS NOT NULL
  AND (
    older."createdAt" < e."createdAt"
    OR (older."createdAt" = e."createdAt" AND older."id" < e."id")
  );

-- Paso 2: índice único. Nombre sigue la convención de Prisma
-- (`<tabla>_<cols>_key`) para que `prisma migrate` lo pueda
-- gestionar si la columna se renombra o se añade otra.
CREATE UNIQUE INDEX "ObraExpense_obraId_reference_key" ON "ObraExpense"("obraId", "reference");
