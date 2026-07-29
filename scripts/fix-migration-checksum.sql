-- Actualiza el checksum al SHA-256 real del contenido del archivo.
-- SHA-256 de migration.sql: 1c400ffddf30197c53045e566e67c9bff7f209e0796cf978101ffcd3297ab42d
UPDATE _prisma_migrations
   SET checksum = '1c400ffddf30197c53045e566e67c9bff7f209e0796cf978101ffcd3297ab42d'
 WHERE migration_name = '20260723000000_add_employee_vacation_balance_advanced_days';
