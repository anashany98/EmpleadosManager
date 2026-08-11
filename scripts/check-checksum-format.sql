SELECT migration_name, length(checksum) as len, checksum FROM _prisma_migrations ORDER BY started_at DESC LIMIT 3;
