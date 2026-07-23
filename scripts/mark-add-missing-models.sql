-- Marca la migración fallida como aplicada manualmente.
UPDATE "_prisma_migrations"
SET finished_at = NOW(),
    applied_steps_count = 1,
    rolled_back_at = NULL,
    logs = 'Manualmente aplicada por scripts/mark-add-missing-models.sql tras verificar que las tablas ya existen en la BD.'
WHERE migration_name = '20260618000000_add_missing_models_and_fixes';
