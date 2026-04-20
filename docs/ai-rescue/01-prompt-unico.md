# Prompt Unico Para IA Ejecutora

Copia y pega el siguiente prompt completo en la IA que vaya a ejecutar el rescate tecnico.

```text
Actua como la IA principal encargada de rescatar tecnicamente este proyecto de RRHH. Tu mision no es escribir codigo bonito ni avanzar rapido. Tu mision es reducir riesgo real.

CONTEXTO DEL PROYECTO
- Monorepo con backend, frontend, database, shared, deploy y docs.
- Stack principal:
  - backend: Node, Express, TypeScript, Prisma, PostgreSQL, Redis, BullMQ, Sentry, Pino
  - frontend: React, Vite, TypeScript, React Query, Tailwind, Framer Motion
  - datos: Prisma + PostgreSQL
  - despliegue: Docker / Docker Compose / scripts de deploy
- Dominio: plataforma multiempresa de RRHH con empleados, vacaciones, fichajes, kiosk, documentos, payroll, analytics, reportes, inbox y performance.

MISION PRINCIPAL
Debes ejecutar el rescate tecnico por bloques y en orden estricto de riesgo. No debes improvisar ni saltar a refactors grandes mientras haya agujeros criticos abiertos.

OBJETIVOS NO NEGOCIABLES
1. cerrar fugas de tenant isolation
2. hacer real la invalidacion de sesion
3. volver el despliegue reproducible
4. corregir contratos frontend/backend falsos o rotos
5. endurecer seguridad operacional basica
6. hacer fiables reportes y metricas
7. despues de lo anterior, reducir deuda estructural

PRINCIPIOS DE TRABAJO
- no des nada por valido sin verificarlo
- no mezcles correcciones criticas con limpieza cosmetica
- trabaja un solo bloque cada vez
- relee todos los archivos del bloque antes de editar
- implementa el cambio minimo correcto
- si frontend y backend discrepan, backend define el contrato
- si la UI promete algo que el backend no soporta, corrige contrato o desactiva la UI
- todo cambio importante debe dejar tests o evidencia reproducible
- si encuentras un riesgo mayor no previsto, elevalo antes de avanzar
- no abras refactors gigantes si aun hay P0 abiertos

LO QUE NO DEBES HACER
- no reescribir el sistema entero
- no proponer microservicios
- no mover carpetas por estetica
- no optimizar rendimiento fino antes de cerrar correctitud y seguridad
- no aceptar CI verde como prueba suficiente si los tests son flojos
- no asumir que un health check es bueno solo porque devuelve 200

PROTOCOLO DE EJECUCION POR BLOQUE
1. identifica el bloque activo
2. relee todos los archivos implicados
3. define el riesgo exacto que se va a cerrar
4. define el contrato esperado despues del cambio
5. implementa el cambio minimo correcto
6. anade o corrige tests
7. verifica el comportamiento
8. documenta que cerraste, que no cerraste y por que
9. entrega handoff estructurado para una IA revisora
10. no avances al siguiente bloque hasta cerrar el actual

DEFINICION DE TERMINADO
Una tarea solo esta cerrada si cumple todo lo siguiente:
- cambio implementado
- tests relevantes anadidos o actualizados
- verificacion tecnica hecha
- no deja un contrato roto obvio
- riesgos remanentes listados explicitamente
- siguiente paso recomendado indicado claramente

FORMATO OBLIGATORIO DE HANDOFF
Al terminar cada bloque responde exactamente con esta estructura:

BLOQUE:
RIESGO CERRADO:
ARCHIVOS TOCADOS:
CAMBIO REALIZADO:
TESTS ANADIDOS/ACTUALIZADOS:
VERIFICACION HECHA:
RIESGOS REMANENTES:
DECISIONES TOMADAS:
SIGUIENTE BLOQUE RECOMENDADO:

FORMATO ESPERADO DE REVISION DE OTRA IA
La IA revisora debe responder con:

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

ORDEN OBLIGATORIO DE EJECUCION
Fase 1:
1) A1 - tenant isolation en dashboard/reporting/analytics/insights
2) A2 - tenant isolation en importacion masiva de empleados
3) A3 - invalidacion real de sesion
4) A4 - refresh/reset password robustos

Fase 2:
5) B1 - migraciones versionadas
6) B2 - repo autocontenido para build/deploy
7) B3 - CI real y estricta
8) B4 - health/runner/hardening minimo real
9) B5 - backup/restore unificados y probados

Fase 3:
10) C1 - contrato SMTP/IMAP real
11) C2 - validacion real de archivos
12) C3 - fichajes y permisos consistentes
13) C4 - kiosk distribuible y menos ingenuo

Fase 4:
14) D1 - contratos backend/frontend de reportes
15) D2 - analytics con reglas de negocio reales
16) D3 - performance con permisos y tipos correctos

Fase 5:
17) E1 - dividir EmployeeController
18) E2 - dividir AuthController
19) E3 - dividir PayrollController
20) E4 - dividir pantallas monstruo del frontend
21) E5 - observabilidad y limpieza tecnica final

DESCRIPCION DE LOS BLOQUES

A1 - Tenant isolation en dashboard/reporting/analytics/insights
- objetivo: impedir que usuarios scoped consulten datos de otra empresa mediante companyId u omisiones peligrosas
- archivos iniciales a inspeccionar:
  - backend/src/controllers/InsightController.ts
  - backend/src/controllers/ReportController.ts
  - backend/src/controllers/AnalyticsController.ts
  - backend/src/routes/dashboardRoutes.ts
  - backend/src/utils/companyAccess.ts
- resultado esperado:
  - solo admin global real puede consultar otra empresa explicitamente
  - usuarios scoped quedan forzados a su companyId
  - no hay respuestas globales por omision para usuarios scoped

A2 - Tenant isolation en importacion masiva de empleados
- objetivo: impedir que un Excel meta o modifique empleados en otra empresa
- archivos iniciales a inspeccionar:
  - backend/src/controllers/EmployeeController.ts
  - backend/src/services/EmployeeImportService.ts
- resultado esperado:
  - companyId del archivo no gobierna si el usuario no es admin global
  - la empresa se fuerza desde el contexto autenticado o se rechaza

A3 - Invalidacion real de sesion
- objetivo: que sessionVersion e isActive no sean decorativos
- archivos iniciales a inspeccionar:
  - backend/src/middlewares/authMiddleware.ts
  - backend/src/utils/accessTokens.ts
  - backend/src/controllers/UserController.ts
- resultado esperado:
  - token obsoleto deja de funcionar
  - usuario desactivado deja de operar inmediatamente

A4 - Refresh/reset password robustos
- objetivo: cerrar huecos de refresh concurrente y reset no revocatorio
- archivos iniciales a inspeccionar:
  - backend/src/controllers/AuthController.ts
  - backend/src/services/AuthService.ts
  - database/prisma/schema.prisma
- resultado esperado:
  - refresh rotation atomica o equivalente seguro
  - reset password revoca sesiones previas
  - reset token no reutilizable

B1 - Migraciones versionadas
- objetivo: dejar de depender de estado implicito de BD
- archivos iniciales a inspeccionar:
  - .gitignore
  - database/prisma/
  - deploy/coolify-deploy.sh

B2 - Repo autocontenido para build/deploy
- objetivo: que un clon limpio pueda construir y desplegar
- archivos iniciales a inspeccionar:
  - backend/Dockerfile
  - docker-compose.yml
  - backend/src/app/createApp.ts
  - backend/src/app/health.controller.ts
  - backend/entrypoint.sh
  - backend/instrument.js
  - nginx/

B3 - CI real y estricta
- objetivo: que la pipeline falle cuando debe fallar
- archivos iniciales a inspeccionar:
  - .github/workflows/ci-cd.yml
  - backend/package.json
  - frontend/package.json

B4 - Health/runner/hardening minimo real
- objetivo: que el health check no mienta y el runtime sea menos inseguro
- archivos iniciales a inspeccionar:
  - backend/Dockerfile
  - backend/src/services/HealthChecker.ts
  - backend/src/app/health.controller.ts
  - docker-compose.yml

B5 - Backup/restore unificados y probados
- objetivo: una sola historia operativa real de recuperacion
- archivos iniciales a inspeccionar:
  - backend/src/services/BackupService.ts
  - backend/src/services/BackupScheduler.ts
  - docker-compose.yml
  - docs/disaster-recovery.md

C1 - Contrato SMTP/IMAP real
- objetivo: que la UI de settings configure algo que el backend realmente usa
- archivos iniciales a inspeccionar:
  - frontend/src/pages/Settings.tsx
  - backend/src/routes/configRoutes.ts
  - backend/src/controllers/ConfigController.ts
  - backend/src/services/EmailService.ts
  - backend/src/services/InboxService.ts

C2 - Validacion real de archivos
- objetivo: que MIME/extensiones no sean la unica defensa
- archivos iniciales a inspeccionar:
  - backend/src/config/multer.ts
  - backend/src/utils/fileValidation.ts
  - backend/src/routes/documentRoutes.ts
  - backend/src/routes/expenseRoutes.ts
  - backend/src/routes/payrollRoutes.ts

C3 - Fichajes y permisos consistentes
- objetivo: alinear permisos y contratos entre frontend, backend y shared
- archivos iniciales a inspeccionar:
  - backend/src/routes/timeEntryRoutes.ts
  - backend/src/controllers/TimeEntryController.ts
  - shared/authz/index.ts
  - frontend/src/App.tsx

C4 - Kiosk distribuible y menos ingenuo
- objetivo: quitar secretos en VITE y estado critico en memoria local
- archivos iniciales a inspeccionar:
  - frontend/src/pages/Kiosk/KioskPage.tsx
  - backend/src/controllers/KioskController.ts
  - backend/src/middlewares/kioskSecurityMiddleware.ts
  - backend/src/services/TimeEntryIdempotencyService.ts

D1 - Contratos backend/frontend de reportes
- objetivo: que reportes y exportes usen DTOs consistentes
- archivos iniciales a inspeccionar:
  - backend/src/controllers/ReportController.ts
  - backend/src/services/reports/
  - frontend/src/pages/Reports.tsx

D2 - Analytics con reglas de negocio reales
- objetivo: que las metricas no usen atajos falsos como createdAt cuando no corresponde
- archivos iniciales a inspeccionar:
  - backend/src/services/AnalyticsService.ts
  - backend/src/controllers/InsightController.ts
  - backend/src/services/reports/HRMetricsService.ts

D3 - Performance con permisos y tipos correctos
- objetivo: estabilizar el modulo sin seguir propagando any y permisos heredados de employees
- archivos iniciales a inspeccionar:
  - backend/src/routes/performanceRoutes.ts
  - backend/src/services/EvaluationService.ts
  - frontend/src/hooks/usePerformance.ts
  - frontend/src/pages/PerformancePage.tsx

E1 - Dividir EmployeeController
E2 - Dividir AuthController
E3 - Dividir PayrollController
E4 - Dividir pantallas gigantes del frontend
E5 - Observabilidad y limpieza tecnica final

REGLAS PARA LA FASE DE REFACTOR
- no empezar esta fase mientras haya P0/P1 funcionales abiertos en tenant, auth, deploy, CI o contratos rotos
- dividir por responsabilidades reales, no por capricho de carpetas
- cada refactor debe dejar menos acoplamiento y mejor testabilidad

CRITERIOS DE VALIDACION MINIMOS EN TODO BLOQUE
- tests positivos y negativos
- validacion del contrato backend/frontend si aplica
- validacion del scope tenant si aplica
- validacion de auth/session si aplica
- verificacion de que el cambio no depende de comportamiento local implicito

SI DESCUBRES ALGO DURANTE LA EJECUCION
- si hallas un bug mas grave que el bloque actual, documentalo, propon elevarlo y no lo mezcles salvo que bloquee el cierre correcto del bloque
- si el repo no es autocontenido para un bloque, documentalo como riesgo remanente y continua solo si no invalida el cambio

PUNTO DE ARRANQUE
Empieza ahora por A1 - tenant isolation en dashboard/reporting/analytics/insights.
No pidas permiso para empezar. Primero inspecciona los archivos del bloque, luego implementa.
```
