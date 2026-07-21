# Migraciones legacy (HIGH-005)

Este directorio contiene scripts SQL que se aplicaron manualmente a
la BD de desarrollo/producción **antes** de que el proyecto tuviera
un árbol de migraciones Prisma completo.

## Por qué está aquí

- `20260626_add_inventory_image.sql`: añade `imageUrl` a `InventoryItem`
- `20260626_calendar_recurrence.sql`: añade `recurrence` y `recurrenceEnd` a `CalendarEvent`
- `20260629_obras_module/`: módulo de Obras (también está en `database/prisma/migrations/20260629000001_add_obras_module/` con contenido idéntico)

## Estado actual

Estas migraciones **ya están incorporadas al schema Prisma** (`database/prisma/schema.prisma`) y a su árbol de migraciones canónico. Los SQL de aquí se conservan solo como referencia histórica.

## Si necesitas una BD nueva

NO ejecutes estos SQL manualmente. Usa:

```bash
cd backend
npx prisma migrate deploy --schema=../database/prisma/schema.prisma
```

## Si tienes una BD con SQL legacy ya aplicado (sin `_prisma_migrations`)

Ejecuta el script de reconciliación:

```bash
cd backend
../scripts/prisma-baseline-legacy.sh
```

Este script marca todas las migraciones Prisma como `applied` sin ejecutarlas (asumiendo que la BD ya tiene el schema correcto), reconciliando el estado de Prisma con la realidad.

## Verificación

Tras el baseline, `prisma migrate status` debe devolver:

```
Database schema is up to date!
```

## Si el baseline falla

Significa que la BD **no** coincide realmente con el schema Prisma. Posibles causas:

1. Faltan columnas: comparar `database/prisma/schema.prisma` con `\d "<table>"` en psql.
2. Sobran columnas: pueden ser de pruebas; eliminarlas o extender el schema.
3. Datos huérfanos: revisar `pg_dump --schema-only` vs `prisma migrate diff`.

En estos casos, lo correcto es restaurar desde backup y empezar de nuevo, **no** inventar SQL ad-hoc.
