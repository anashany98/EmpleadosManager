# Deployment Guide - Coolify

## URL de la App
**Producción:** https://empleadosmanager.egeadev.cloud

---

## Servicios Requeridos

La aplicación necesita 4 servicios:
1. **PostgreSQL** (Base de datos)
2. **Redis** (Cache y Queue)
3. **Backend** (API Node.js)
4. **Frontend** (Nginx con React buildado)

---

## Paso 1: Crear Base de Datos PostgreSQL

1. Ir a Coolify → New Resource → Database → PostgreSQL
2. Configurar:
   - Name: `manager-db`
   - Version: 15-alpine
   - Database Name: `manager_db`
   - User: `manager`
   - Password: [generar una segura]
3. Anotar los datos de conexión:
   - Host: (IP del servicio)
   - Port: 5432
   - DB: manager_db
   - User: manager
   - Password: (la que generaste)

---

## Paso 2: Crear Redis

1. Ir a Coolify → New Resource → Database → Redis
2. Configurar:
   - Name: `manager-redis`
   - Version: 7-alpine
3. Anotar Host y Puerto (6379)

---

## Paso 3: Crear Backend

1. Ir a Coolify → New Resource → Application → Git Repository
2. Configurar:
   - Name: `manager-backend`
   - Git URL: [URL de tu repositorio]
   - Branch: main
   - Build Pack: Dockerfile
   - Dockerfile Location: `backend/Dockerfile`

3. Variables de Entorno requeridas:
```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://manager:[PASSWORD]@[HOST]:5432/manager_db?schema=public&connection_timeout=10
JWT_SECRET=[generar clave segura - min 32 caracteres]
ENCRYPTION_KEY=[generar clave de 32 caracteres]
CORS_ORIGIN=https://empleadosmanager.egeadev.cloud
FRONTEND_URL=https://empleadosmanager.egeadev.cloud
COOKIE_SECURE=true
COOKIE_SAMESITE=strict
CSRF_COOKIE_NAME=csrf_token
CSRF_HEADER_NAME=x-csrf-token
CSRF_MAX_AGE_MS=604800000
REDIS_HOST=[IP de Redis]
REDIS_PORT=6379
STORAGE_PROVIDER=local
PRISMA_QUERY_TIMEOUT=10000
PRISMA_CONNECT_TIMEOUT=10000
```

4. Puerto: 3000

---

## Paso 4: Crear Frontend

1. Ir a Coolify → New Resource → Application → Git Repository
2. Configurar:
   - Name: `manager-frontend`
   - Git URL: [URL de tu repositorio]
   - Branch: main
   - Build Pack: Dockerfile
   - Dockerfile Location: `frontend/Dockerfile`

3. Variables de Entorno:
```
VITE_API_URL=https://empleadosmanager.egeadev.cloud
```

4. Puerto: 80

5. Configurar dominio: `empleadosmanager.egeadev.cloud`

---

## Generador de Claves Seguras

Ejecutar en terminal:
```bash
# JWT_SECRET (mínimo 32 caracteres)
openssl rand -base64 32

# ENCRYPTION_KEY (exactamente 32 caracteres)
openssl rand -hex 16
```

---

## Verificación Post-Deploy

1. **Health Check:**
```
GET https://empleadosmanager.egeadev.cloud/api/health
```

2. **Logs:** Ver en Coolify → Resources → manager-backend → Logs

3. **Testing:**
- Login funciona
- Empleados se cargan
- Documentos suben correctamente

---

## Notas Importantes

- La base de datos se puede crear desde cero con `npx prisma db push`
- Los backups se configuran en Coolify → Resource → Backups
- SSL es automático con Let's Encrypt
- Primera vez: hacer migrate a la base de datos