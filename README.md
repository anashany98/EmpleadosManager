# EmpleadosManager — Sistema de Gestión de RRHH

Sistema completo de gestión de empleados con nóminas, control de ausencias, horas extras y fichajes. Multi-tenant con autenticación JWT/CSRF, cifrado en reposo de PII, y Docker Compose para el stack local.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Características Principales

### Gestión de Empleados

- Ficha completa con datos personales, laborales y financieros
- Importación masiva desde Excel (exceljs, validación de magic bytes)
- Soft-delete (GDPR Art. 17) con purga programada por retention period
- Historial de cambios y auditoría (AuditService)

### Nóminas y Finanzas

- Importación de nóminas desde Excel con reglas versionadas (PayrollRulesService)
- Cálculo automático de costes con redondeo contable ROUND_HALF_EVEN
- Gestión de horas extras con tarifas por categoría
- Subcuentas contables (465)
- Generación de PDFs con cifrado en reposo de DNI/SS

### Gestión de Ausencias

- Calendario global de empresa (iCal export)
- Tipos: Vacaciones, Bajas médicas, Permisos, Horas médicas
- Cálculo automático de días laborables
- Cupo proporcional según fecha de alta
- Generación de justificantes PDF

### Control de Fichajes

- Registro de entradas/salidas con pausas
- Cálculo automático de horas trabajadas
- Vista individual por empleado
- Calendario global de control horario
- Importación desde Excel
- WebSocket para actualizaciones en tiempo real

### Multi-empresa

- Gestión de múltiples empresas
- Filtrado por empresa en dashboard
- Asignación de empleados por empresa
- Aislamiento tenant en todos los controllers (CRIT-001..004 + HIGH-001..003)

### Analytics y Reportes

- Dashboard con métricas clave
- Alertas automáticas (vencimientos, ausencias)
- Tendencias de contratación
- Informes de ausencias, horas, costes, bajas, igualdad
- Reportes programables (ReportScheduler)
- Memoria de salud del sistema (HealthChecker)

## Stack Tecnológico

### Frontend

- **React 19** + **TypeScript**
- **Vite 7** — Build tool ultrarrápido
- **TailwindCSS** — Styling
- **Framer Motion** — Animaciones
- **Recharts** — Gráficos
- **Lucide React** — Iconos
- **Sonner** — Notificaciones toast
- **jsPDF** + **jspdf-autotable** — Generación de PDFs
- **TanStack Query** — Cache de API
- **Socket.IO client** — WebSocket
- **Service Worker** — PWA con cache versionado (MED-011)

### Backend

- **Node.js 22+** + **Express** + **TypeScript**
- **Prisma 5** ORM — PostgreSQL 15
- **Redis 7** — Cache + BullMQ (job queues)
- **BullMQ** — Cola de jobs (OCR, email, etc.)
- **PostgreSQL 15** — Base de datos principal
- **Multer** — Upload de archivos (validación de magic bytes, no validación por extensión)
- **exceljs** — Procesamiento de Excel (xlsx reemplazado por advisories, HIGH-007)
- **Tesseract.js** — OCR de documentos
- **Socket.IO** — WebSocket server
- **Helmet** — Headers de seguridad HTTP
- **Pino** — Logging estructurado

## Instalación

### Requisitos Previos

- **Node.js** >= 22.0.0
- **Docker** + **Docker Compose** (para el stack local: PostgreSQL + Redis)
- **npm** >= 9.0.0

### Setup (desde cero)

1. **Clonar el repositorio**

```bash
git clone https://github.com/anashany98/EmpleadosManager.git
cd EmpleadosManager
```

2. **Copiar variables de entorno**

```bash
cp .env.example .env
cp backend/.env.example backend/.env
# Editar y rellenar: JWT_SECRET, ENCRYPTION_KEY, BACKUP_ENCRYPTION_KEY
# (mínimo 32 bytes aleatorios cada uno; usar `openssl rand -hex 32`)
```

3. **Levantar infraestructura (PostgreSQL + Redis)**

```bash
docker compose up -d postgres redis
# Espera a que ambos pasen el healthcheck (~10s)
docker compose ps
```

Si los puertos `5432` o `6379` ya están ocupados, ajustar en `.env`:

```bash
POSTGRES_PORT=55432
REDIS_PORT=6381
DATABASE_URL=postgresql://nominas:nominas_local_pw_2026@localhost:55432/nominas_db?schema=public
```

4. **Instalar dependencias**

```bash
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

5. **Aplicar migraciones Prisma + generar client**

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate:deploy   # producción / CI
# o, en dev, para crear/editar migraciones:
# npm run prisma:migrate         # dev con nombre de migración
cd ..
```

6. **Arrancar la aplicación (2 terminales)**

**Terminal 1 — Backend:**

```bash
cd backend
npm run dev
# Backend en http://localhost:3000
# Health: http://localhost:3000/api/health/liveness
```

**Terminal 2 — Frontend:**

```bash
cd frontend
npm run dev
# Frontend en http://localhost:5173
```

7. **Acceder a la aplicación**

Abrir `http://localhost:5173` en el navegador. Login con las credenciales seed (ver `backend/src/scripts/seed-admin.ts`).

## Estructura del Proyecto

```
EmpleadosManager/
├── frontend/                  # Aplicación React (Vite)
│   ├── src/
│   │   ├── api/               # Cliente API (con retry policy, MED-006)
│   │   ├── components/        # Componentes reutilizables
│   │   ├── contexts/          # React contexts (Auth, etc.)
│   │   ├── pages/             # Páginas principales
│   │   ├── hooks/             # Custom hooks
│   │   └── utils/             # Utilidades
│   └── public/                # Assets estáticos + sw.js
│
├── backend/                   # API Express
│   ├── src/
│   │   ├── controllers/       # Capa HTTP (request/response)
│   │   ├── services/          # Lógica de negocio
│   │   ├── routes/            # Definición de rutas Express
│   │   ├── middlewares/       # Auth, error handling, CSRF
│   │   ├── workers/           # BullMQ workers (OCR, etc.)
│   │   ├── lib/               # Prisma client, etc.
│   │   ├── utils/             # Helpers (fileDownload, controllerError, etc.)
│   │   ├── app/               # Bootstrap (createApp, health)
│   │   └── tests/             # Tests organizados por área
│   ├── prisma/                # (NO, schema está en database/)
│   └── uploads/               # Archivos subidos (volumen Docker)
│
├── database/                  # Configuración Prisma
│   └── prisma/
│       ├── schema.prisma      # Esquema (PostgreSQL)
│       └── migrations/        # Historial de migraciones
│
├── shared/                    # Código compartido FE/BE (tipos, authz)
│
├── nginx/                     # Reverse proxy para producción
│   ├── templates/             # default.conf.template (envsubst)
│   └── validate-config.sh     # Validación local
│
├── scripts/                   # Scripts operativos
│   ├── prisma-local.mjs       # Wrapper Prisma con --schema
│   └── mark-pending-migrations.sql
│
├── docker-compose.yml         # Stack dev (Postgres, Redis, backend, frontend, nginx, backup, rclone)
├── docker-compose.coolify.yml # Stack producción (Coolify)
└── .github/workflows/         # CI/CD (lint, tests, build, deploy, security)
```

## Seguridad

El sistema implementa defense-in-depth en múltiples capas:

### Backend

- **Autenticación**: JWT con refresh tokens rotativos, cookies httpOnly+secure+SameSite
- **CSRF**: Middleware con token por sesión, header `X-CSRF-Token` requerido en mutaciones
- **Cifrado en reposo**: AES-256-GCM para DNI, SS, IBAN (`EncryptionService`)
- **Autorización centralizada**: `actorContext.ts` + policy engine (HIGH-001..003, IMP-001)
- **Multi-tenancy**: `assertSameTenantOrGlobal` en todos los controllers sensibles (CRIT-001..004)
- **Headers de seguridad**: helmet + CSP (MED-008)
- **Rate limiting**: nginx (`limit_req` con zonas `api` y `login`)
- **Validación de uploads**: magic bytes (no extensión), antivirus via ClamAV opcional
- **Path traversal defense**: `serveLocalUploadFile` con verificación de contención (barrido MED-007)
- **Info leak prevention**: `handleControllerError` censura mensajes internos en 5xx (MED-007)
- **Auditoría**: `AuditService` con retries para todas las mutaciones
- **Backup cifrado**: `BACKUP_ENCRYPTION_KEY` con AES-256, rotación diaria vía `BACKUP_SCHEDULE`

### Frontend

- **HTTPS obligatorio en producción** (HSTS con `preload`)
- **CSP estricta** (script-src, frame-ancestors, etc.)
- **CORS** restringido a `CORS_ORIGIN` (no `*`)
- **Retry policy** con método-aware (no reintenta POST no idempotente, MED-006)
- **Service Worker** con cache versionado por build hash (MED-011) y `CLEAR_CACHES` en logout

## Tests

```bash
# Backend
cd backend
npm test                       # vitest watch
npm run test:coverage          # una pasada con cobertura
npm run lint:strict            # lint con budget de warnings

# Frontend
cd frontend
npm test
npm run test:coverage
npm run lint
npm run test:e2e               # Playwright (requiere stack arriba)
```

Cobertura actual: 744 tests backend + 97 tests frontend + 3 skip (CSV edge cases pendientes, ver LOW-003).

## Despliegue

### Opción 1: Coolify (recomendado para producción)

```bash
# 1. En Coolify: crear recurso "Docker Compose" apuntando a docker-compose.coolify.yml
# 2. Configurar env vars (ver .env.example)
# 3. Coolify se encarga del proxy HTTPS, certificados Let's Encrypt, backups
```

### Opción 2: Docker Compose manual

```bash
docker compose up -d
# Auto-arranca: postgres, redis, backend, frontend, nginx, backup, rclone (OneDrive)
```

### Opción 3: Build estático + nginx externo

```bash
cd backend && npm run build && cd ..
cd frontend && npm run build && cd ..
# Servir frontend/dist/ y proxy /api a backend:3000 con nginx externo
```

## Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

MIT — ver [LICENSE](LICENSE) para más detalles.

## Autor

**Anas Hany Lahroudy**

- GitHub: [@anashany98](https://github.com/anashany98)

## Agradecimientos

- Iconos por [Lucide](https://lucide.dev/)
- UI inspirado en diseños modernos de RRHH
- Comunidad de React y Node.js

---

⭐ Si este proyecto te fue útil, considera darle una estrella en GitHub!
