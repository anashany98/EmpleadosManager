-- Test seed: create a few absence requests for Anas Hany (admin user)
-- to visually verify the report separation.
-- Idempotent: deletes any existing test rows first.

DELETE FROM "Vacation" WHERE "employeeId" = 'ca0f8576-1236-4440-8443-fa204fa90479' AND "reason" LIKE 'TEST-SEED-%';

INSERT INTO "Vacation" ("id", "employeeId", "startDate", "endDate", "type", "absenceType", "days", "reason", "status", "createdAt", "updatedAt")
VALUES
  -- VACATION: 5 days in 2026
  (gen_random_uuid(), 'ca0f8576-1236-4440-8443-fa204fa90479', '2026-08-01', '2026-08-05', 'VACATION', 'VACATION', 5, 'TEST-SEED-vacaciones', 'APPROVED', NOW(), NOW()),
  -- VACATION: 3 days pending
  (gen_random_uuid(), 'ca0f8576-1236-4440-8443-fa204fa90479', '2026-12-23', '2026-12-26', 'VACATION', 'VACATION', 3, 'TEST-SEED-navidad', 'PENDING', NOW(), NOW()),
  -- SICK: 2 days
  (gen_random_uuid(), 'ca0f8576-1236-4440-8443-fa204fa90479', '2026-03-10', '2026-03-12', 'SICK', 'SICK', 2, 'TEST-SEED-baja-gripe', 'APPROVED', NOW(), NOW()),
  -- MARRIAGE: 15 days
  (gen_random_uuid(), 'ca0f8576-1236-4440-8443-fa204fa90479', '2026-06-01', '2026-06-15', 'MARRIAGE', 'MARRIAGE', 15, 'TEST-SEED-boda', 'APPROVED', NOW(), NOW()),
  -- MEDICAL_APPOINTMENT: 1 day
  (gen_random_uuid(), 'ca0f8576-1236-4440-8443-fa204fa90479', '2026-04-15', '2026-04-15', 'MEDICAL_APPOINTMENT', 'MEDICAL_APPOINTMENT', 1, 'TEST-SEED-cita-medica', 'APPROVED', NOW(), NOW());
