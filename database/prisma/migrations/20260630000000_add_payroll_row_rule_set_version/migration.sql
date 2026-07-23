-- HIGH-009: Persistir la versión de la regla fiscal usada para
-- cada PayrollRow. Permite reproducir nóminas históricas aunque
-- cambien las tasas. Es NULL para filas generadas antes de este
-- cambio (no se recalculan; sólo se etiqueta la nueva generación).
ALTER TABLE "PayrollRow" ADD COLUMN "ruleSetVersion" TEXT;
