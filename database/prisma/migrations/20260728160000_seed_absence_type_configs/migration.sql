-- The configuration UI existed before its catalogue was used by the rest of
-- the application, but production databases were never populated. Keep this
-- idempotent so existing customer configuration is never overwritten.
INSERT INTO "AbsenceTypeConfig"
    ("id", "code", "name", "color", "icon", "description", "annualLimitDays",
     "countsForBalance", "requiresAttachment", "requiresApproval", "isActive",
     "createdAt", "updatedAt")
VALUES
    (gen_random_uuid(), 'VACATION', 'Vacaciones', '#10b981', 'plane', 'Vacaciones anuales retribuidas', 30, true, false, true, true, NOW(), NOW()),
    (gen_random_uuid(), 'SICK', 'Baja médica', '#f43f5e', 'stethoscope', 'Ausencia por enfermedad o accidente', NULL, false, true, true, true, NOW(), NOW()),
    (gen_random_uuid(), 'MEDICAL_APPOINTMENT', 'Cita médica', '#6366f1', 'clock', 'Cita médica con justificante', NULL, false, true, true, true, NOW(), NOW()),
    (gen_random_uuid(), 'MATERNITY', 'Maternidad', '#ec4899', 'baby', 'Permiso de maternidad', NULL, false, true, true, true, NOW(), NOW()),
    (gen_random_uuid(), 'PATERNITY', 'Paternidad', '#0ea5e9', 'baby', 'Permiso de paternidad', NULL, false, true, true, true, NOW(), NOW()),
    (gen_random_uuid(), 'PERSONAL_DAY', 'Día personal', '#06b6d4', 'sun', 'Día personal sin necesidad de justificante', 5, false, false, true, true, NOW(), NOW()),
    (gen_random_uuid(), 'MARRIAGE', 'Boda', '#f43f5e', 'heart', 'Permiso por matrimonio', NULL, false, true, true, true, NOW(), NOW()),
    (gen_random_uuid(), 'DEATH', 'Fallecimiento', '#475569', 'file-text', 'Permiso por fallecimiento de familiar', NULL, false, true, true, true, NOW(), NOW()),
    (gen_random_uuid(), 'MOVING', 'Mudanza', '#f59e0b', 'plane', 'Permiso por mudanza', NULL, false, true, true, true, NOW(), NOW()),
    (gen_random_uuid(), 'FAMILY_SICK', 'Enfermedad familiar', '#f43f5e', 'stethoscope', 'Ausencia por cuidado de familiar enfermo', NULL, false, true, true, true, NOW(), NOW()),
    (gen_random_uuid(), 'PUBLIC_DUTY', 'Función pública', '#3b82f6', 'file-text', 'Cumplimiento de función pública', NULL, false, true, true, true, NOW(), NOW()),
    (gen_random_uuid(), 'UNPAID', 'Permiso sin goce', '#f59e0b', 'file-text', 'Ausencia sin retribución', NULL, false, false, true, true, NOW(), NOW()),
    (gen_random_uuid(), 'LACTANCIA', 'Lactancia', '#ec4899', 'baby', 'Permiso de lactancia', NULL, false, false, true, true, NOW(), NOW()),
    (gen_random_uuid(), 'TELETRABAJO', 'Teletrabajo', '#8b5cf6', 'coffee', 'Jornada de teletrabajo', NULL, false, false, true, true, NOW(), NOW()),
    (gen_random_uuid(), 'PERMISO_SINDICAL', 'Permiso sindical', '#14b8a6', 'file-text', 'Permiso por actividad sindical', NULL, false, false, true, true, NOW(), NOW()),
    (gen_random_uuid(), 'OTHER', 'Otros', '#64748b', 'more-horizontal', 'Otro tipo de ausencia no categorizada', NULL, false, false, true, true, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;
