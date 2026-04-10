# Deployment Checklist - Coolify

## ✅ Pre-Deploy

- [ ] Repositorio subito a Git (GitHub/GitLab)
- [ ] Branch configurada en Coolify
- [ ] Dominio SSL configurado

---

## 🔧 Coolify: PostgreSQL

| Campo | Valor |
|------|------|
| Name | manager-db |
| Version | 15-alpine |
| Database | manager_db |
| User | manager |
| Password | [generar] |

---

## 🔧 Coolify: Redis

| Campo | Valor |
|------|------|
| Name | manager-redis |
| Version | 7-alpine |

---

## 🔧 Coolify: Backend

| Campo | Valor |
|------|------|
| Name | manager-backend |
| Build Pack | Dockerfile |
| Dockerfile | backend/Dockerfile |
| Port | 3000 |
| Git | [tu repo] |
| Branch | main |

### Variables:
```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://manager:[PASS]@[HOST]:5432/manager_db
JWT_SECRET=[generar 32+ chars]
ENCRYPTION_KEY=[generar 32 chars exacta]
CORS_ORIGIN=https://empleadosmanager.egeadev.cloud
FRONTEND_URL=https://empleadosmanager.egeadev.cloud
COOKIE_SECURE=true
COOKIE_SAMESITE=strict
REDIS_HOST=[IP_REDIS]
REDIS_PORT=6379
PRISMA_QUERY_TIMEOUT=10000
PRISMA_CONNECT_TIMEOUT=10000
```

---

## 🔧 Coolify: Frontend

| Campo | Valor |
|------|------|
| Name | manager-frontend |
| Build Pack | Dockerfile |
| Dockerfile | frontend/Dockerfile |
| Port | 80 |
| Domain | empleadosmanager.egeadev.cloud |

### Variables:
```
VITE_API_URL=https://empleadosmanager.egeadev.cloud
```

---

## ⚠️ Notas Importantes

1. **Orden de creación:**
   - 1. PostgreSQL
   - 2. Redis  
   - 3. Backend
   - 4. Frontend

2. **Dependencias en Coolify:**
   - Backend depends_on: PostgreSQL, Redis
   - Frontend depends_on: Backend

3. **Primera vez:**
   - Backend necesita `npx prisma db push` o migrations
   - Crear usuario admin inicial

---

## ✅ Post-Deploy

- [ ] Health check: `/api/health`
- [ ] SSL activo
- [ ] Login funciona
- [ ] Empleados cargan
- [ ] Documentos subiendo
- [ ] Backups configurados

---

## 📞 Debug

```bash
# Ver logs
coolify logs manager-backend

# Reiniciar
coolify restart manager-backend

# Exec en container
coolify exec manager-backend -- sh
```