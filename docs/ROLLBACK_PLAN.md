# 🔄 Plan de Rollback - EmpleadosManager

## Propósito
Este documento describe el procedimiento para revertir cambios en producción de manera segura y rápida.

## Regla Obligatoria Antes de Migrar

No ejecutes migraciones en producción sin backup verificable. Antes de `prisma migrate deploy`:

```bash
mkdir -p backups
docker compose exec postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backups/pre-migration-$(date +%Y%m%d%H%M%S).sql
npm run db:status
```

El backup debe existir, tener tamaño mayor que cero y poder restaurarse en staging. Si `npm run db:status` muestra drift o migraciones desconocidas, detén el despliegue y resuelve el historial en staging.

## No Hacer

- No ejecutar `prisma migrate reset --force` en producción.
- No borrar filas de `_prisma_migrations` sin backup y aprobación explícita.
- No desplegar una imagen nueva si el rollback de base de datos no está probado.

---

## 🚨 Cuándo Hacer Rollback

### Escenarios que Requieren Rollback Inmediato
1. **Error crítico** que impide el uso del sistema (>50% de usuarios afectados)
2. **Pérdida de datos** o corrupción detectada
3. **Vulnerabilidad de seguridad** descubierta en nueva versión
4. **Degradación severa** de rendimiento (tiempos de respuesta >10s)
5. **Health checks fallando** continuamente (>5 minutos)

### Escenarios que NO Requieren Rollback
1. Bugs menores que afectan a <5% de usuarios
2. Problemas cosméticos/UI
3. Features opcionales que no funcionan (pero no bloquean)

---

## 📋 Procedimiento de Rollback

### Opción 1: Rollback de Docker (Recomendado)

```powershell
# 1. Identificar la versión anterior
docker images | Select-String "rrhh-"

# 2. Detener servicios actuales
docker-compose down

# 3. Usar la imagen anterior (tag con SHA o versión)
docker-compose.yml  # Cambiar tags de imagen a versión anterior

# 4. Reconstruir con versión anterior
docker-compose up -d

# 5. Verificar salud
docker-compose ps
curl http://localhost:16161/api/health
```

### Opción 2: Rollback de Base de Datos

```powershell
# 1. Detener aplicación
docker-compose stop backend frontend

# 2. Restaurar backup más reciente
docker-compose exec postgres psql -U nominas nominas_db < /backups/latest.sql

# 3. Reiniciar aplicación
docker-compose start backend frontend

# 4. Verificar datos
docker-compose exec backend npx prisma db pull
```

### Opción 3: Rollback de Migraciones Prisma

```powershell
# 1. Ver estado actual de migraciones
docker-compose exec backend npx prisma migrate status

# 2. Revertir última migración
docker-compose exec backend npx prisma migrate resolve --rolled-back <migration_name>

# 3. O resetear completamente (⚠️ DESTRUYE DATOS)
docker-compose exec backend npx prisma migrate reset --force
```

---

## 🎯 Criterios de Éxito del Rollback

### Verificaciones Post-Rollback
- [ ] Health endpoint responde 200: `curl http://localhost:16161/api/health`
- [ ] Frontend carga correctamente: `http://localhost:17171`
- [ ] Login funciona con credenciales conocidas
- [ ] No hay errores críticos en logs: `docker-compose logs --tail=100 backend`
- [ ] Base de datos conectada: `docker-compose exec backend npx prisma db pull`
- [ ] Redis conectado: `docker-compose exec redis redis-cli ping`
- [ ] Backups funcionando: `docker-compose exec backup ls /backups`

### Métricas a Monitorear (primeras 2h)
- Tasa de errores HTTP 5xx (<1%)
- Tiempo de respuesta promedio (<2s)
- Uso de memoria/CPU (<80%)
- Conexiones de base de datos (<50)

---

## 📞 Contactos de Emergencia

| Rol | Contacto | Responsabilidad |
|-----|----------|----------------|
| DevOps Lead | devops@tuempresa.com | Coordinar rollback |
| Backend Dev | backend@tuempresa.com | Verificar API |
| DBA | dba@tuempresa.com | Verificar datos |
| Product Owner | po@tuempresa.com | Decidir rollback |

---

## 📝 Registro de Rollbacks

| Fecha | Versión | Motivo | Duración | Responsable |
|-------|---------|--------|----------|-------------|
| | | | | |

---

## 🔧 Comandos Rápidos

```powershell
# Ver estado actual
docker-compose ps

# Ver logs en tiempo real
docker-compose logs -f backend

# Reiniciar servicio específico
docker-compose restart backend

# Ver uso de recursos
docker stats

# Entrar en contenedor para debug
docker-compose exec backend sh

# Ver backups disponibles
docker-compose exec backup ls -la /backups

# Forzar recreación de contenedores
docker-compose up -d --force-recreate

# Limpiar todo (⚠️ DESTRUYE DATOS LOCALES)
docker-compose down -v
```

---

**Última actualización**: 2026-04-16  
**Versión**: 1.0.0
