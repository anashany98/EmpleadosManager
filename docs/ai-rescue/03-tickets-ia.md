# Tickets Para IA Ejecutora

Cada ticket esta redactado para ser tomado por una IA y ejecutado de forma aislada. No mezclar tickets salvo que el propio ticket lo exija o dependa directamente de otro.

---

## Ticket A1 - Cerrar tenant isolation en dashboard/reporting/analytics/insights

- Prioridad: P0
- Objetivo: impedir que usuarios scoped consulten datos de otra empresa usando `companyId`, defaults inseguros o rutas demasiado abiertas.
- Archivos base a inspeccionar:
  - `backend/src/controllers/InsightController.ts`
  - `backend/src/controllers/ReportController.ts`
  - `backend/src/controllers/AnalyticsController.ts`
  - `backend/src/routes/dashboardRoutes.ts`
  - `backend/src/utils/companyAccess.ts`
- Trabajo esperado:
  - resolver el scope de empresa desde el usuario autenticado
  - permitir override de `companyId` solo a admin global real
  - eliminar respuestas globales por omision para usuarios scoped
  - endurecer rutas de dashboard si estan abiertas en exceso
- Criterios de aceptacion:
  - usuario scoped no puede forzar otra empresa por query
  - admin global si puede consultar otra empresa explicitamente
  - endpoints sin `companyId` usan empresa del usuario scoped
  - no hay endpoint sensible protegido solo por `protect` si requiere permiso especifico
- Tests minimos:
  - positivo admin global
  - negativo usuario scoped con companyId ajeno
  - negativo usuario scoped sin permiso especifico en dashboard sensible
- Dependencias: ninguna
- No hacer:
  - no refactorizar todo el modulo analytics aun
  - no tocar UI salvo que el contrato cambie

---

## Ticket A2 - Cerrar tenant isolation en importacion masiva de empleados

- Prioridad: P0
- Objetivo: impedir que un Excel gobierne `companyId` fuera del contexto autorizado.
- Archivos base a inspeccionar:
  - `backend/src/controllers/EmployeeController.ts`
  - `backend/src/services/EmployeeImportService.ts`
- Trabajo esperado:
  - definir politica clara para `companyId` en import
  - forzar empresa del usuario scoped o rechazar import incompatible
  - permitir override solo a admin global si el negocio lo admite
- Criterios de aceptacion:
  - un usuario de empresa no puede importar en otra empresa
  - el import no mete datos cross-tenant
  - la politica queda explicita en codigo y tests
- Tests minimos:
  - import scoped con companyId ajeno falla
  - import scoped sin companyId asigna empresa del usuario o valida segun politica
  - admin global con companyId explicito funciona si esta permitido
- Dependencias: A1 recomendable, no estricta

---

## Ticket A3 - Hacer real la invalidacion de sesion

- Prioridad: P0
- Objetivo: que `sessionVersion` e `isActive` se apliquen en autenticacion real.
- Archivos base a inspeccionar:
  - `backend/src/middlewares/authMiddleware.ts`
  - `backend/src/utils/accessTokens.ts`
  - `backend/src/controllers/UserController.ts`
- Trabajo esperado:
  - validar version de sesion en `protect`
  - rechazar usuarios desactivados
  - asegurar consistencia entre emision y validacion del token
- Criterios de aceptacion:
  - desactivar usuario invalida access tokens vigentes
  - incrementar sessionVersion invalida tokens previos
  - usuarios activos con version correcta siguen operando
- Tests minimos:
  - token obsoleto => 401
  - usuario inactive => 401/403 consistente
  - token valido => OK
- Dependencias: ninguna

---

## Ticket A4 - Endurecer refresh y reset password

- Prioridad: P0
- Objetivo: cerrar refresh concurrente inseguro y reset password sin revocacion real.
- Archivos base a inspeccionar:
  - `backend/src/controllers/AuthController.ts`
  - `backend/src/services/AuthService.ts`
  - `database/prisma/schema.prisma`
- Trabajo esperado:
  - hacer refresh rotation atomica o semantica equivalente segura
  - revocar sesiones en password reset
  - evitar reuso de token de reset
- Criterios de aceptacion:
  - refresh concurrente no deja ramas validas paralelas peligrosas
  - reset password invalida sesiones previas
  - token de reset reutilizado falla
- Tests minimos:
  - doble refresh concurrente
  - reset y acceso con token viejo
  - token de reset reutilizado
- Dependencias: A3 recomendable

---

## Ticket B1 - Versionar migraciones Prisma

- Prioridad: P0
- Objetivo: que la historia de BD sea reproducible.
- Archivos base a inspeccionar:
  - `.gitignore`
  - `database/prisma/`
  - `deploy/coolify-deploy.sh`
- Trabajo esperado:
  - dejar de ignorar migraciones
  - crear baseline si hace falta
  - alinear deploy con `prisma migrate deploy`
- Criterios de aceptacion:
  - migraciones presentes en repo
  - deploy no depende de estado previo implicito
  - cliente Prisma se regenera desde estado versionado
- Tests/verificacion:
  - clean setup aplica migraciones
- Dependencias: ninguna

---

## Ticket B2 - Hacer el repo autocontenido para build y deploy

- Prioridad: P0
- Objetivo: que un clon limpio construya sin archivos fantasma.
- Archivos base a inspeccionar:
  - `backend/Dockerfile`
  - `docker-compose.yml`
  - `backend/src/app/createApp.ts`
  - `backend/src/app/health.controller.ts`
  - `backend/entrypoint.sh`
  - `backend/instrument.js`
  - `nginx/`
- Trabajo esperado:
  - versionar o eliminar dependencias invisibles del workspace
  - corregir Dockerfiles/compose segun el arbol real
- Criterios de aceptacion:
  - build backend/frontend en clon limpio
  - compose no referencia paths ausentes
  - runtime minimo completo esta en git
- Dependencias: B1 recomendable

---

## Ticket B3 - Convertir CI en gate real

- Prioridad: P1
- Objetivo: que la pipeline falle cuando haya fallos reales.
- Archivos base a inspeccionar:
  - `.github/workflows/ci-cd.yml`
  - `backend/package.json`
  - `frontend/package.json`
- Trabajo esperado:
  - quitar tolerancia innecesaria a errores
  - corregir scripts/flags invalidos
  - asegurar lint, typecheck, tests y build coherentes
- Criterios de aceptacion:
  - CI roja cuando debe
  - no hay pasos placebo
  - comandos existen y son reproducibles
- Dependencias: B2 recomendable

---

## Ticket B4 - Health checks y runtime honestos

- Prioridad: P1
- Objetivo: que health y runtime no den falsa sensacion de seguridad.
- Archivos base a inspeccionar:
  - `backend/Dockerfile`
  - `backend/src/services/HealthChecker.ts`
  - `backend/src/app/health.controller.ts`
  - `docker-compose.yml`
- Trabajo esperado:
  - separar liveness/readiness si hace falta
  - quitar metricas inventadas o placeholders enganiosos
  - ejecutar backend como usuario no root si es viable
- Criterios de aceptacion:
  - liveness simple y honesta
  - readiness refleja dependencias reales
  - runtime menos inseguro
- Dependencias: B2

---

## Ticket B5 - Unificar backup y restore

- Prioridad: P0
- Objetivo: que exista una sola historia real de recuperacion.
- Archivos base a inspeccionar:
  - `backend/src/services/BackupService.ts`
  - `backend/src/services/BackupScheduler.ts`
  - `docker-compose.yml`
  - `docs/disaster-recovery.md`
- Trabajo esperado:
  - elegir una estrategia realista
  - alinear implementacion y documentacion
  - definir prueba de restore verificable
- Criterios de aceptacion:
  - docs e implementacion dicen lo mismo
  - restore probado o al menos scriptado y verificable
- Dependencias: B2 recomendable

---

## Ticket C1 - Corregir contrato SMTP/IMAP

- Prioridad: P0
- Objetivo: que la configuracion de correo/inbox deje de ser una ilusion.
- Archivos base a inspeccionar:
  - `frontend/src/pages/Settings.tsx`
  - `backend/src/routes/configRoutes.ts`
  - `backend/src/controllers/ConfigController.ts`
  - `backend/src/services/EmailService.ts`
  - `backend/src/services/InboxService.ts`
- Trabajo esperado:
  - definir endpoints explicitos y tipados para SMTP/IMAP
  - alinear lo que guarda la UI con lo que lee el backend
  - proteger secretos razonablemente
- Criterios de aceptacion:
  - guardar SMTP desde UI afecta al backend real
  - test email usa el mismo origen de configuracion
  - no queda ruta generica peligrosa para config sensible
- Dependencias: A3/A4 muy recomendables

---

## Ticket C2 - Cablear validacion real de archivos

- Prioridad: P1
- Objetivo: validar contenido real antes de OCR o almacenamiento definitivo.
- Archivos base a inspeccionar:
  - `backend/src/config/multer.ts`
  - `backend/src/utils/fileValidation.ts`
  - `backend/src/routes/documentRoutes.ts`
  - `backend/src/routes/expenseRoutes.ts`
  - `backend/src/routes/payrollRoutes.ts`
- Trabajo esperado:
  - aplicar magic byte validation en el flujo real
  - rechazar archivos inconsistentes
  - evitar OCR en basura o formatos simulados
- Criterios de aceptacion:
  - fake pdf/jpg/xlsx se rechaza
  - archivos validos siguen funcionando
- Dependencias: ninguna estricta

---

## Ticket C3 - Alinear permisos y validacion en fichajes

- Prioridad: P1
- Objetivo: que frontend, backend y shared digan lo mismo sobre quien puede gestionar fichajes.
- Archivos base a inspeccionar:
  - `backend/src/routes/timeEntryRoutes.ts`
  - `backend/src/controllers/TimeEntryController.ts`
  - `shared/authz/index.ts`
  - `frontend/src/App.tsx`
- Trabajo esperado:
  - elegir policy unica
  - aplicarla en rutas y controladores
  - adaptar frontend al contrato real
  - anadir validacion tipada a endpoints si falta
- Criterios de aceptacion:
  - manager/hr/admin ven exactamente lo que backend autoriza
  - no hay drift de permisos
- Dependencias: A1 recomendable

---

## Ticket C4 - Endurecer kiosk para multiinstancia

- Prioridad: P1
- Objetivo: eliminar secretos en el cliente y estado critico solo en memoria del proceso.
- Archivos base a inspeccionar:
  - `frontend/src/pages/Kiosk/KioskPage.tsx`
  - `backend/src/controllers/KioskController.ts`
  - `backend/src/middlewares/kioskSecurityMiddleware.ts`
  - `backend/src/services/TimeEntryIdempotencyService.ts`
- Trabajo esperado:
  - quitar confianza en `VITE_*` como secreto
  - mover counters/idempotencia/cache a backend durable o Redis
  - mantener flujo de kiosk operable
- Criterios de aceptacion:
  - no hay secreto embebido en frontend como defensa principal
  - reiniciar proceso no rompe seguridad basica ni idempotencia
- Dependencias: A3/A4 recomendables

---

## Ticket D1 - Estabilizar DTOs de reportes

- Prioridad: P1
- Objetivo: alinear formas de respuesta y consumo frontend/backend.
- Archivos base a inspeccionar:
  - `backend/src/controllers/ReportController.ts`
  - `backend/src/services/reports/`
  - `frontend/src/pages/Reports.tsx`
- Trabajo esperado:
  - definir DTOs estables por reporte
  - adaptar frontend a esos DTOs
  - revisar exportes PDF/XLSX si dependen de la forma de datos
- Criterios de aceptacion:
  - frontend deja de asumir estructuras incompatibles
  - exportes se generan con datos correctos
- Dependencias: A1

---

## Ticket D2 - Corregir analytics con reglas de negocio defendibles

- Prioridad: P1
- Objetivo: que las metricas no usen atajos enganiosos.
- Archivos base a inspeccionar:
  - `backend/src/services/AnalyticsService.ts`
  - `backend/src/controllers/InsightController.ts`
  - `backend/src/services/reports/HRMetricsService.ts`
- Trabajo esperado:
  - recalcular headcount, turnover y absentismo con fechas y estados de negocio reales
  - revisar filtros por empresa
  - revisar cache si dana consistencia
- Criterios de aceptacion:
  - metricas basadas en datos correctos de negocio
  - no dependen de `createdAt` como atajo si no corresponde
  - tests con fixtures verificables
- Dependencias: A1, D1 recomendables

---

## Ticket D3 - Endurecer modulo performance

- Prioridad: P1
- Objetivo: dejar de heredar permisos ambiguos y reducir `any` en estructuras clave.
- Archivos base a inspeccionar:
  - `backend/src/routes/performanceRoutes.ts`
  - `backend/src/services/EvaluationService.ts`
  - `frontend/src/hooks/usePerformance.ts`
  - `frontend/src/pages/PerformancePage.tsx`
- Trabajo esperado:
  - revisar permisos del modulo
  - estabilizar tipos principales
  - alinear frontend y backend
- Criterios de aceptacion:
  - performance no usa permisos de otro dominio por inercia
  - menos `any` en contratos principales
- Dependencias: A1 recomendable

---

## Ticket E1 - Dividir EmployeeController

- Prioridad: P1
- Objetivo: separar lectura, escritura, import, training y medical review.
- Archivos base a inspeccionar:
  - `backend/src/controllers/EmployeeController.ts`
- Trabajo esperado:
  - extraer responsabilidades reales en modulos razonables
  - mantener contratos HTTP existentes salvo necesidad justificada
- Criterios de aceptacion:
  - archivo principal sustancialmente mas pequeno
  - responsabilidades separadas con menor acoplamiento
- Dependencias: A2 completado

---

## Ticket E2 - Dividir AuthController

- Prioridad: P1
- Objetivo: separar login, sesion, refresh, reset, invitaciones y logout.
- Archivos base a inspeccionar:
  - `backend/src/controllers/AuthController.ts`
- Criterios de aceptacion:
  - controladores/servicios por flujo
  - no se degrada seguridad ni contratos
- Dependencias: A3 y A4 completados

---

## Ticket E3 - Dividir PayrollController

- Prioridad: P1
- Objetivo: separar upload, mapping, manual payroll, pdf y generacion automatica.
- Archivos base a inspeccionar:
  - `backend/src/controllers/PayrollController.ts`
  - `backend/src/services/payroll/` si se crea
- Criterios de aceptacion:
  - controller deja de ser archivo monstruo
  - casos de uso mas aislados y testeables
- Dependencias: D1 recomendable

---

## Ticket E4 - Dividir pantallas gigantes del frontend

- Prioridad: P1
- Objetivo: sacar logica de negocio y side effects de componentes monstruo.
- Archivos base a inspeccionar:
  - `frontend/src/pages/GlobalAssetsPage.tsx`
  - `frontend/src/pages/UserManagement.tsx`
  - `frontend/src/components/VacationCalendar.tsx`
  - `frontend/src/pages/Settings.tsx`
  - `frontend/src/pages/Reports.tsx`
- Trabajo esperado:
  - extraer hooks, helpers y subcomponentes
  - no mezclar rediseno visual con refactor estructural
- Criterios de aceptacion:
  - menos logica de negocio incrustada en UI
  - descargas/exportes/dialogos centralizados donde tenga sentido
- Dependencias: C1, D1 recomendables

---

## Ticket E5 - Observabilidad y limpieza tecnica final

- Prioridad: P2
- Objetivo: consolidar logs, errores y limpieza de deuda visible despues de estabilizar lo critico.
- Archivos base a inspeccionar:
  - `backend/src/services/LoggerService.ts`
  - `backend/src/middlewares/errorMiddleware.ts`
  - `backend/src/app/createApp.ts`
  - `backend/src/index.ts`
  - docs y archivos con BOM/mojibake visibles
- Trabajo esperado:
  - reducir `console.*`
  - unificar logging estructurado
  - limpiar encoding roto, archivos debug peligrosos y restos de deuda obvia
- Criterios de aceptacion:
  - errores con mas contexto
  - menos ruido y menos deuda visible gratuita
- Dependencias: fases 1 a 4 completadas

---

## Plantilla de salida que debe usar cualquier IA al cerrar un ticket

```text
BLOQUE:
RIESGO CERRADO:
ARCHIVOS TOCADOS:
CAMBIO REALIZADO:
TESTS ANADIDOS/ACTUALIZADOS:
VERIFICACION HECHA:
RIESGOS REMANENTES:
DECISIONES TOMADAS:
SIGUIENTE BLOQUE RECOMENDADO:
```

## Plantilla de revision que debe usar la IA revisora

```text
RESULTADO: APROBADO | CORRECCIONES NECESARIAS | RIESGO NO RESUELTO
HALLAZGOS:
- ...
REGRESIONES POSIBLES:
- ...
VALIDACION DE SEGURIDAD:
- ...
VALIDACION DE CONTRATO:
- ...
VALIDACION DE TESTS:
- ...
SIGUIENTE ACCION:
- ...
```
