# 🛠️ Análisis del Proyecto — Soluciones y Mejoras

**Proyecto:** EmpleadosManager — Sistema de Gestión de RRHH
**Stack:** React 19 + TypeScript + Vite (frontend) · Node.js + Express + TypeScript + Prisma (backend) · PostgreSQL + Redis
**Rama analizada:** `feature/modulo-obras`
**Fecha del análisis:** 2026-07-14

---

## 📑 Índice

1. [Resumen ejecutivo](#-resumen-ejecutivo)
2. [Estado general del proyecto](#-estado-general-del-proyecto)
3. [Qué se resolvió desde el análisis anterior (2026-07-02)](#-qué-se-resolvió-desde-el-análisis-anterior)
4. [Problemas críticos](#-problemas-críticos)
5. [Problemas de alto impacto](#-problemas-de-alto-impacto)
6. [Problemas de impacto medio](#-problemas-de-impacto-medio)
7. [Infraestructura, CI/CD y DevOps](#-infraestructura-cicd-y-devops)
8. [Base de datos y Prisma](#-base-de-datos-y-prisma)
9. [Deuda técnica](#-deuda-técnica)
10. [Higiene del repositorio](#-higiene-del-repositorio)
11. [Plan de acción priorizado](#-plan-de-acción-priorizado)
12. [Notas metodológicas](#-notas-metodológicas)

---

## 🎯 Resumen ejecutivo

La base del proyecto es **sólida y madura**. La arquitectura mantiene prácticas defensivas serias (JWT con rotación de refresh tokens, AES-256-GCM para PII/salarios, bcrypt centralizado, rate limiting, CSRF, helmet con CSP, soft-delete con retención GDPR, autorización por policies, validación de magic-bytes en uploads, CI/CD completo con Trivy + trufflehog + npm audit).

Desde el análisis anterior (2026-07-02) **ya se resolvieron 6 hallazgos** del frontend (error handling, EventSource, tema, jspdf, matchMedia, memo en tablas). El módulo Obras avanza pero arrastra **bugs críticos nuevos** y una **migración fuera del pipeline Prisma** que deja la DB inconsistente con el schema en entornos limpios.

**No hay vulnerabilidades de arquitectura nuevas.** Lo que sí hay:

| Categoría        | Hallazgos                                          | Impacto                                                         |
| ---------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| 🐛 Bugs backend  | 5 críticos + 8 altos                               | Imports corruptos, nómina mal calculada, inventario descuadrado |
| 🖥️ Bugs frontend | 1 crítico + 5 altos                                | Race conditions, modales inaccesibles, data layer sin tipar     |
| 🗄️ Base de datos | 4 medios                                           | Migraciones Obras huérfanas, soft-delete parcial                |
| 🚀 Infra/CI      | 3 críticos + 6 medios                              | Secretos locales, supply-chain, cache CI                        |
| 🧹 Deuda técnica | ~800 `any`, 31 modales duplicados, archivos "dios" | Mantenibilidad                                                  |
| 🗑️ Higiene repo  | Directorios de agente cacheados, scripts debug     | Claridad                                                        |

Este documento lista **cada problema con su solución concreta y la ruta del archivo afectado**.

---

## 📊 Estado general del proyecto

| Dimensión          | Estado                                               | Notas                                                 |
| ------------------ | ---------------------------------------------------- | ----------------------------------------------------- |
| **Backend**        | ~43.700 LOC, 56 controladores, 83 servicios          | Maduro, bien separado                                 |
| **Frontend**       | ~45 páginas, 36+ componentes                         | Algo de lógica duplicada                              |
| **Modelos Prisma** | 40+ modelos                                          | Bien indexados, `onDelete` correcto                   |
| **Tests**          | 63 backend + 17 frontend                             | Cobertura desigual; Obras/Payroll/ExcelService pobres |
| **E2E**            | Playwright (configurado, no ejecutado en CI)         | Mínimo                                                |
| **CI/CD**          | lint + typecheck + tests + build + security + deploy | Completo                                              |
| **Docs**           | Runbooks, troubleshooting, manual usuario            | Buenos                                                |

---

## ✅ Qué se resolvió desde el análisis anterior

El análisis previo (2026-07-02) marcó 6 hallazgos frontend que **ya están arreglados**. No se repiten como problemas:

| Hallazgo previo                                           | Estado      | Evidencia                                                                                |
| --------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| F1 — `error.response?.data?.error` (patrón axios roto)    | ✅ Resuelto | 0 call sites activos; el helper canónico es `getErrorMessage()` en `api/client.ts:47-53` |
| F3 — `EventSource` con `{ withCredentials: true } as any` | ✅ Resuelto | `NotificationContext.tsx:47` sin options; comentario `F3`                                |
| H3 — Conflicto de claves localStorage de tema             | ✅ Resuelto | App y Header usan la misma key `'theme'` (constante `THEME_KEY`)                         |
| H4 — `jspdf` import estático en Reports                   | ✅ Resuelto | Lazy-import en `Reports.tsx:117-120`                                                     |
| H5 — Resize listener sin debounce                         | ✅ Resuelto | `App.tsx:83-90` usa `matchMedia`                                                         |
| H6 — Tabla sin `React.memo`                               | ✅ Resuelto | `EmployeesTable.tsx:24` con `memo` + `Set` O(1)                                          |

---

## 🔴 Problemas críticos

### C1 — `var _finalValid` declarado dos veces (corrupción de imports Obras)

**Archivo:** `backend/src/controllers/ObraImportController.ts:416-418`

```ts
// línea 416
var _finalValid = finalValidCrossDup;
} else {
// línea 418
var _finalValid = finalValidAfterDup;
```

`var` tiene scope de función, no de bloque. Funciona por accidente porque ambas ramas son mutuamente excluyentes, pero cualquier reordenamiento rompe la idempotencia del commit. La transacción de la línea 423 usa la variable correcta solo por coincidencia de control de flujo.

**Solución:**

```ts
let finalValidRows: ImportRowValid[];
if (refsToCheck.length > 0) {
  finalValidRows = finalValidAfterDup.filter(
    (r) => !existingSet.has(`${r.obraId}::${r.reference}`)
  );
} else {
  finalValidRows = finalValidAfterDup;
}
```

---

### C2 — Validación redundante con rama muerta en `ObraImportService.validate`

**Archivo:** `backend/src/services/ObraImportService.ts:97-107`

```ts
if (!typeRaw || !(OBRA_EXPENSE_TYPES as readonly string[]).includes(typeRaw)) {
  if (typeRaw)
    warnings.push('INVALID_TYPE'); // rama A
  else warnings.push('INVALID_TYPE'); // rama B — idéntica
}
```

El `if/else` interno empuja **exactamente el mismo warning** en ambas ramas (código muerto). Además la condición del `invalid.push` (`warnings.length > 0 && (warnings.includes('MISSING_OBRA_CODE') || ...)`) es tautológica: si se llegó ahí, `warnings` solo puede contener uno de esos valores.

**Solución:**

```ts
const typeOk = typeRaw && (OBRA_EXPENSE_TYPES as readonly string[]).includes(typeRaw);
if (!typeOk) warnings.push('INVALID_TYPE');
// ...
if (warnings.length > 0) { invalid.push(...); continue; }
```

---

### C3 — Rate limiting con memory store (ineficaz en multi-instancia)

**Archivo:** `backend/src/app/createApp.ts:97-142`

Los limiters (`intranetLimiter`, `payrollLimiter`, `importLimiter`, `exportLimiter`) usan `express-rate-limit` cuyo store por defecto es **en memoria**. En despliegues con N pods, cada instancia lleva su propio contador → el límite real se multiplica por N y la protección anti-abuso/DoS desaparece tras el balanceador.

Existe `services/RedisRateLimiter.ts` (sliding window correcto) pero **solo se usa para auth/PIN**, no para los limiters HTTP globales.

**Solución:**

```bash
npm i rate-limit-redis
```

```ts
import RedisStore from 'rate-limit-redis';
import { redis } from '../config/redis';

const importLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  store: new RedisStore({ sendCmd: (...args) => (redis as any).call(...args) }),
  // ...
});
```

---

### C4 — Cifrado legacy AES-256-CBC sin autenticidad (tampering indetectable)

**Archivo:** `backend/src/services/EncryptionService.ts:101-110`

El `decrypt` mantiene un fallback a AES-256-CBC para registros legacy. CBC **no tiene auth tag**, así que al descifrar no se valida autenticidad. Un atacante con acceso de escritura a la DB puede manipular ciphertexts legacy de campos sensibles (IBAN, SSN) y el `decrypt` los acepta o devuelve `null` silenciosamente (línea 113).

Además hay **dos implementaciones de cifrado** (`utils/encryption.ts` para backups y `services/EncryptionService.ts` para PII) que comparten nombres parecidos → riesgo de mezclar claves.

**Solución:**

1. Migrar todos los registros CBC legacy a GCM en un job programado (existe `GdprPurgeScheduler.ts` como referencia de patrón).
2. Tras la migración, **eliminar la rama CBC** y devolver error explícito si el formato no es `gcm:`.
3. Unificar en un único módulo con dos claves tipadas (`piiKey`, `backupKey`).

---

### C5 — Fallback `'system'` / `'anonymous'` en audit log rompe trazabilidad

**Archivos:** `backend/src/controllers/ObraImportController.ts:64,137,276` · `ObraExpenseController.ts:63,106,144` · `ObraController.ts:152,210,265,287` · `services/documents/EPIService.ts:25`

```ts
const userId = user?.id || 'system';
```

Si `protect` ya garantiza `req.user` (lanza 401 si no), el `user?.id` nunca es `undefined` aquí. El fallback es **código muerto** que, si se ejecutara (ruta mal configurada sin `protect`), atribuiría acciones a un usuario fantasma `'system'` en el audit log, rompiendo la trazabilidad legal (GDPR/auditoría de nómina).

**Solución:**

```ts
const userId = (req as AuthenticatedRequest).user?.id;
if (!userId) throw new AppError('Usuario no autenticado', 401);
```

---

### C6 — Credenciales admin en claro en disco (`scripts/login.json`)

**Archivos:** `scripts/login.json` · `backend/scripts/login.json`

Contienen `{"email":"admin@admin.com","password":"AdminObras2026!"}`. Aunque **no están trackeadas en git** (verificado con `git ls-files`), están en disco junto al código y se filtran fácilmente a backups/imagenes Docker.

**Solución:**

1. Eliminar ambos archivos.
2. **Rotar** la contraseña `AdminObras2026!` (asumiendo que se usa en algún entorno).
3. Usar variables de entorno / secret manager para credenciales de prueba.
4. Añadir a `.gitignore`: `scripts/login.json` y `backend/scripts/login.json`.

---

### C7 — Actions de seguridad pinneadas con tags mutables

**Archivo:** `.github/workflows/ci-cd.yml:230,245`

`aquasecurity/trivy-action@master` y `trufflesecurity/trufflehog@main`. Un atacante que comprometa el upstream puede inyectar código en tu pipeline de seguridad (supply-chain). El resto de actions sí están pinneadas por major (`@v4`, `@v3`).

**Solución:** fijar por SHA commit (`aquasecurity/trivy-action@<sha-full>`) y mantener actualizado con Dependabot.

---

### C8 — `build-essential` en imagen de producción

**Archivo:** `backend/Dockerfile:62`

`build-essential` (gcc, make, ~200 MB de toolchain) en el stage `runner` de producción. Aumenta superficie de ataque y peso de imagen. Solo se justifica si módulos nativos (canvas, bcryptjs, tesseract.js) lo requieren en runtime.

**Solución:** verificar si los módulos nativos necesitan compilación en runtime; si no, usar `apt-get install --no-install-recommends` solo las librerías runtime (`libcairo2`, `libpango1.0-0`, `libjpeg62-turbo`, `libgif7`, `postgresql-client`, `gosu`). Mover `build-essential` al stage `builder`.

---

## 🟠 Problemas de alto impacto

### A1 — El mismo Excel se parsea 3 veces (upload, preview, commit)

**Archivo:** `backend/src/controllers/ObraImportController.ts:78-93, 151-164, 291-342`

El flujo re-parsea el archivo con `PrestoParser.detectAndParse` (carga completa del workbook en memoria) en cada paso. Costoso (3× CPU/memoria) y fuente de **divergencia**: si el archivo cambia en storage entre preview y commit, operan sobre datos distintos. No hay hash/checksum que verifique integridad.

**Solución:** parsear una vez en `upload`, persistir `pedidos` ya mapeados en `obraImportBatch` (campo JSON), y que `preview`/`commit` lean de ahí. Añadir `sha256` del buffer al batch:

```ts
const sha = crypto.createHash('sha256').update(buffer).digest('hex');
// en commit: if (batch.fileSha !== sha) throw 409;
```

---

### A2 — `ObraAuthorization.ensureCanAccess` definido pero nunca invocado

**Archivo:** `backend/src/services/obraAuthorization.ts:25-43`

La función de scoping por rol (managers solo ven sus obras) existe, pero ninguna ruta/controlador la llama (verificado con `grep`). `obraRoutes.ts:21` aplica solo `protect + requireGlobalAdmin + checkPermission('projects','read')` — **solo admins globales** acceden. `ObraExpenseController.listByObra` usa `ensureExists` (sin check de acceso).

Resultado: la lógica de multi-tenancy/manager-scoped está muerta.

**Solución:** cablear donde corresponde:

```ts
// ObraExpenseController.listByObra y ObraController.getById:
await ObraAuthorization.ensureCanAccess(obraId, (req as AuthenticatedRequest).user!);
```

O eliminarla si la decisión es admin-only.

---

### A3 — Import de empleados: fallos de chunk silenciados (sub-reporte de errores)

**Archivo:** `backend/src/services/EmployeeImportService.ts:252-408`

```ts
} catch (transactionError: any) {
    log.error({ chunkStart, error: transactionError.message }, 'Chunk transaction failed, continuing with next chunk');
    // ← no se hace push a errors[]
}
```

Si la transacción de un chunk falla, se loguea y se continúa, pero los errores **no se añaden a `errors`**. El reporte final (`importedCount, errors`) sub-reporta: el usuario ve "importados 950, 0 errores" cuando 50 filas realmente fallaron. Además, si una sola fila del chunk falla (DNI con constraint), las otras 99 válidas del chunk se pierden — no hay aislamiento por fila.

También: `createAutoCompany` genera CIFS tipo `AUTO-XXXXXXXXXX` que contaminan el catálogo de empresas reales.

**Solución:**

```ts
} catch (transactionError: any) {
    log.error(...);
    errors.push(`Chunk filas ${chunkStart+2}-${chunkStart+CHUNK_SIZE+1}: ${transactionError.message}`);
    continue;
}
```

Y procesar el chunk fallido fila a fila como fallback. Para empresas auto: marcarlas `isAutoCreated: true` para revisión.

---

### A4 — Validación de CSV con magic bytes vacía (cualquier binario pasa)

**Archivos:** `backend/src/utils/fileSecurity.ts:47-50` · `config/multer.ts:23, 83-98`

```ts
'text/csv': [{ signature: [], offset: 0 }]   // ← firma vacía = todo pasa
```

CSV tiene signature vacía → `validateMagicBytes` devuelve `true` para **cualquier contenido**. Combinado con que `obraImportRoutes.ts:14` permite `.csv`, un atacante puede subir un `.csv` cuyo contenido sea un binario (polyglot ZIP/JS) y pasa la validación. Además `validateUpload` no valida CSV en absoluto (no hay case para `.csv`). La función `checkSuspiciousContent` existe pero **no se invoca** desde el flujo de import.

**Solución:**

```ts
if (ext === '.csv') {
  const issues = checkSuspiciousContent(buffer);
  if (issues.length) throw new AppError(`CSV sospechoso: ${issues.join(',')}`, 400);
}
```

Y rechazar si hay >X% bytes nulos en CSV.

---

### A5 — Nómina: tasas IRPF/SS hardcodeadas (cálculo incorrecto)

**Archivo:** `backend/src/services/PayrollAutomationService.ts:129-142`

```ts
const IRPF_RATE = 0.15; // hardcodeado — 15% fijo para todos
const SS_WORKER_RATE = 0.0635;
const SS_COMPANY_RATE = 0.236;
const expectedHours = (employee.weeklyHours ? employee.weeklyHours * 4.33 : 160) || 160;
const salaryFactor = proportion > 1.1 ? 1.1 : proportion;
```

1. **IRPF fijo al 15%** para todos, ignorando tramos, retenciones configuradas o situación. En nómina española es **materialmente incorrecto** y generaría errores en liquidación a Hacienda.
2. **Tope del 1.1×** recorta el bruto de quien hace horas extra.
3. `expectedHours = weeklyHours * 4.33` no considera festivos ni vacaciones del periodo.
4. Las constantes son globales — no respetan `agreementType` (convenio) que sí existe en el modelo.

**Solución:** mover tasas a configuración por empresa/convenio (tabla `PayrollConfig` o campo en `Company`), aplicar retención IRPF progresiva por tramo. Como mínimo, marcar siempre los rows con `status: 'WARNING'` detallando las asunciones, no solo cuando `proportion < 0.8`.

---

### A6 — `ObraExpenseController.update` permite cambiar `status` sin flujo de aprobación

**Archivo:** `backend/src/controllers/ObraExpenseController.ts:11-18, 117-120`

`FORBIDDEN_EXPENSE_UPDATE_KEYS` **no incluye `status`**, y el schema `obraExpenseUpdateSchema` permite `status: obraExpenseStatusSchema.optional()`. Cualquier usuario con `projects:write` puede auto-aprobar/rechazar gastos cambiando `status` a `APPROVED`/`REJECTED` sin flujo de aprobación. Brecha de control interno. (El import inserta siempre `status: 'APPROVED'` directamente — `ObraImportController.ts:439`.)

**Solución:** añadir `status` a `FORBIDDEN_EXPENSE_UPDATE_KEYS` y crear `POST /:id/approve` con su propio check de permisos, o prohibir `status` en updates.

---

### A7 — `ExcelService.generateAttendanceReport` asume `data` ordenado por timestamp

**Archivo:** `backend/src/services/ExcelService.ts:56-58`

```ts
{ label: 'Primer registro', value: data[0]?.timestamp ? formatDate(data[0].timestamp) : '-' },
{ label: 'Último registro', value: data[data.length - 1]?.timestamp ? ... },
```

Si el caller no garantiza orden, "Primer"/"Último registro" son cualquier elemento, no el cronológicamente primero/último. En un reporte de auditoría es información errónea.

**Solución:**

```ts
const timestamps = data.map((d) => d.timestamp?.getTime()).filter(Boolean) as number[];
const first = timestamps.length ? formatDate(new Date(Math.min(...timestamps))) : '-';
const last = timestamps.length ? formatDate(new Date(Math.max(...timestamps))) : '-';
```

---

### A8 — EPIService: inventario descuadrado en rollback inconsistente

**Archivo:** `backend/src/services/documents/EPIService.ts:18-53, 117-122`

La automatización de inventario (`InventoryService.recordMovement` + `prisma.asset.create`) se ejecuta **antes** del `document.create`. Si `document.create` falla, se borra el PDF pero **no se revierten los movimientos de inventario**: el stock se descuenta y el asset se asigna, pero no hay acta PDF ni registro `document`. El empleado aparece con un EPI asignado sin entrega firmada. Los `catch (err)` internos tragan los errores con solo `logger.warn`.

**Solución:** envolver todo en una transacción Prisma, o revertir los movimientos de inventario en el catch del `document.create`:

```ts
for (const item of createdMovements) {
    await InventoryService.recordMovement({ itemId: item.id, type: 'REVERSAL', ... }).catch(...);
}
```

---

### A9 (frontend) — Race conditions generalizadas sin AbortController

**Archivos:** ~40 archivos. Ej.: `AlertCenter.tsx`, `DocumentArchive.tsx`, `ExpenseManager.tsx`, `OverviewTab.tsx`, `HRTab.tsx`, `FinancialTab.tsx`, `EmployeeAdministrationSection.tsx`, `EmployeeVacationSection.tsx`, `MyProfilePage.tsx`, `VacationSelfServiceView.tsx`, `Reports.tsx`.

`useEffect` + `api.*` sin `signal` en ~40 archivos. El cliente **ya soporta** `signal` (`client.ts:70, 140-146`), pero casi nadie lo pasa. Navegar a mitad de petición actualiza estado de componente desmontado y puede escribir datos obsoletos. Solo `EmployeeImportWizard.tsx:82-88` protege races (con contador `requestId`).

**Solución:** threadear `AbortSignal` en cada effect y abortar en cleanup:

```ts
useEffect(() => {
    const ac = new AbortController();
    api.get('/employees/' + id, { signal: ac.signal }).then(...);
    return () => ac.abort();
}, [id]);
```

---

### A10 (frontend) — Contrato de datos inconsistente en el data layer

**Archivos:** `hooks/usePerformance.ts` (13 lecturas `response.data` sin `success` check), `hooks/useAnalytics.ts` (7), `features/self-service/vacations/VacationManagementView.tsx` (6), `components/DocumentArchive.tsx`, `EmployeeImportWizard.tsx:90` (`(response as any).data || response`).

El backend envuelve en `{ success, data, meta, message }`, y `customFetch` retorna el **envelope completo** (`client.ts:249`). Pero los call sites lo consumen de 3 formas distintas: leyendo `res.success`/`res.data`/`res.meta` (correcto), leyendo `response.data` **sin chequear `success`** (frágil), o con el hack `(response as any).data || response` (admite que no se sabe la forma).

**Solución:** consolidar `extractResponseData` (duplicado en `useEmployeeDetail.ts:37` y `CalendarPage.tsx:115`) en un único sitio de `api/client.ts`, y aplicarlo en todos los hooks. Idealmente que `customFetch` devuelva `data` ya desempaquetado.

---

### A11 (frontend) — 31 modales re-implementados sin el `ui/Modal` accesible

**Archivo:** `components/ui/Modal.tsx` (accesible: focus trap, `aria-modal`, Escape, restauración de foco) — **solo se importa en 1 archivo** (`GlobalAssetsStockTab.tsx`). En cambio **31 archivos** declaran overlays con `fixed inset-0` a mano, sin `role="dialog"`/`aria-modal`/focus-trap/Escape.

Peores por tamaño/duplicación: `pages/CalendarPage.tsx` (4 overlays), `features/self-service/vacations/VacationSelfServiceView.tsx` (3), `EmployeePayrollViewer.tsx`, `OffboardingWizard.tsx`, `KioskAdminPanel.tsx`, `DocumentPreview.tsx`, `CommandPalette.tsx` (2 c/u).

**Solución:** refactor de cada overlay hacia `ui/Modal`. Empezar por `CalendarPage.tsx` y `VacationSelfServiceView.tsx`.

---

## 🟡 Problemas de impacto medio

### M1 — Detección de contenido sospechoso solo escanea los primeros 10 KB

**Archivo:** `backend/src/utils/fileSecurity.ts:126`

`checkSuspiciousContent` lee `buffer.toString('utf8', 0, Math.min(buffer.length, 10000))`. Un payload malicioso (`<?php`, `UNION SELECT`) colocado después del byte 10.000 no se detecta. Trivial de evadir en archivos de 5 MB.

**Solución:** escanear por streaming en chunks, o muestrear varios offsets. Para XLSX/DOCX (que son ZIP), inspeccionar los archivos internos descomprimidos.

---

### M2 — `AuthService.login` no incrementa contador de intentos fallidos localmente

**Archivo:** `backend/src/services/AuthService.ts:33-35`

Verifica `lockedUntil` al inicio pero **nunca lo actualiza** tras un fallo. El lockout depende de `middlewares/accountLockout.ts` (que sí tiene tests). Si el middleware falla o se omite, no hay protección a nivel de servicio (falta defense in depth).

**Solución:** en el catch de credenciales incorrectas, llamar a `accountLockout.registerFailure(user.id)` además del middleware.

---

### M3 — Refresh token con SHA-256 simple (sin pepper) y sin rotación en login

**Archivo:** `backend/src/services/AuthService.ts:46-47`

`crypto.createHash('sha256').update(refreshToken)` — SHA-256 simple, no HMAC. Si la DB permite leer e inyectar, un atacante podría forjar tokens con un hash precomputado. Además, al hacer login de nuevo **no se invalidan los refresh tokens previos** del usuario — acumulación de sesiones válidas.

**Solución:** HMAC con pepper de env, y `prisma.refreshToken.deleteMany({ where: { userId } })` (o `update sessionVersion`) en login para rotar.

---

### M4 — CORS permite `origin === undefined`

**Archivo:** `backend/src/app/createApp.ts:144-147`

Peticiones same-origin o no-navegador no envían `Origin`. Permitirlas es estándar, pero en combinación con `credentials: true` conviene endurecer.

**Solución:** en producción estricta, rechazar `!origin` en endpoints sensibles (cambio de contraseña, eliminación). Documentar la asunción.

---

### M5 — `ObraController.update` inconsistent en FORBIDDEN keys

**Archivo:** `backend/src/controllers/ObraController.ts:23-32`

`FORBIDDEN_UPDATE_KEYS` incluye `code`/`status` (correcto), pero las listas de keys prohibidos no se comparten entre `ObraController`, `ObraExpenseController`. `createdById` debería estar en ambas.

**Solución:** extraer a `utils/forbiddenKeys.ts` y reutilizar.

---

### M6 (frontend) — `recharts` (~400 KB) importado estáticamente en 7 archivos

**Archivos:** `FinancialTab.tsx`, `HRTab.tsx`, `VacationManagementView.tsx` (576 líneas), `EmployeeDashboard.tsx` y 3 en `components/dashboard/analytics/`.

Debería cargarse perezosamente como ya se hace con `jspdf` (patrón `H4`).

**Solución:** import dinámico dentro del componente que renderiza el gráfico, o `React.lazy` en el wrapper.

---

### M7 (frontend) — `Reports.tsx` re-fetch sin debounce ni cancelación

**Archivo:** `frontend/src/pages/Reports.tsx:62-64`

El effect tiene 7 dependencias (filtros) y re-ejecuta `fetchData` en cada cambio, sin debounce ni cancelación de la petición anterior → peticiones solapadas y posible seteo de datos obsoletos.

**Solución:** debounce del effect (300ms) + `AbortController` + React Query con `keepPreviousData`.

---

### M8 (frontend) — Data layer de Reports sin tipar (14+ `any`)

**Archivo:** `frontend/src/features/reports/reportDataProcessing.ts`

`getNormalizedRows(activeTab, data: any)`, `buildSummaryCards(activeTab, rows: any[], data: any)`, `buildInsight(...)`, `buildPdfTable(...)` y todos los `.map((item: any) => ...)`. `Reports.tsx:32` declara `useState<any>(null)`. Cada reporte (ATTENDANCE, VACATIONS, OBRA...) tiene su propia fila sin interfaz compartida.

**Solución:** definir `interface` por `ReportType` en `frontend/src/types/reports.ts` y tipar todas las funciones de procesado.

---

### M9 (frontend) — `NotificationContext.markRead`/`markAllRead` solo locales

**Archivo:** `frontend/src/contexts/NotificationContext.tsx:35-41`

Registran el evento en state pero **no persisten el estado leído en el backend**. Al recargar, todo vuelve a "no leído".

**Solución:** llamar al endpoint de marca-leído del backend en `markRead`/`markAllRead`.

---

### M10 (frontend) — Directorios `context/` y `contexts/` duplicados

**Archivos:** `context/ConfirmContext.tsx` (solo) vs `contexts/` (`AuthContext`, `LockContext`, `NotificationContext`).

Mismo prefijo conceptual en dos carpetas. Ambos se importan en `App.tsx:212-213`.

**Solución:** mover `ConfirmContext.tsx` a `contexts/`.

---

## 🚀 Infraestructura, CI/CD y DevOps

### I1 — CI sólido, base buena ✅

El `.github/workflows/ci-cd.yml` cubre: lint + typecheck (matrix backend/frontend), tests backend con Postgres+Redis services y coverage a Codecov, tests frontend, build Docker (push en main, build-only en PR), **Trivy** (SARIF a GitHub Security), **trufflehog** (secretos verificados), **npm audit** en 3 niveles.

---

### I2 — Cache de Buildx ausente (builds lentos)

**Archivo:** `.github/workflows/ci-cd.yml:189-218`

Se configura `docker/setup-buildx-action@v3` pero los builds usan `docker build` plano (sin `--cache-from`/`--cache-to`, sin `docker/build-push-action`). Cada CI reconstruye capas desde cero (~5-8 min desperdiciados por run).

**Solución:** reemplazar los pasos `docker build` con `docker/build-push-action@v5`:

```yaml
with:
  cache-from: type=gha
  cache-to: type=gha,mode=max
```

---

### I3 — Falta job de bundle-size / Lighthouse en CI

**Archivo:** `.github/workflows/ci-cd.yml`

El frontend (`CalendarPage.tsx` 1049 líneas, `PerformancePage.tsx` 695) puede inflar el bundle sin que nadie lo note. No hay budget de tamaño.

**Solución:** añadir un job que ejecute `vite-bundle-visualizer` o `bundlesize` tras el build, fijar un budget (p. ej. < 350 KB JS gzip inicial).

---

### I4 — E2E configurado pero no ejecutado en CI

Playwright está configurado (`frontend/package.json` `test:e2e`) pero no hay job en CI. Cobertura E2E mínima (login, employees, navigation).

**Solución:** añadir job E2E en CI con Playwright sobre el build de PR.

---

### I5 — nginx del frontend corre como root

**Archivo:** `frontend/Dockerfile:36-68`

No hay directiva `USER nginx`; el master process corre como root (comportamiento por defecto). El `chown -R nginx:nginx` prepara permisos pero no dropea privilegios del master. El backend sí dropea correctamente vía `gosu appuser`.

**Solución:** añadir `USER nginx` antes del `CMD`, o usar `nginxinc/nginx-unprivileged:1.25-alpine` (puerto 8080, ajustar `EXPOSE` y compose).

---

### I6 — `read_only: false` en backend (hardening incompleto)

**Archivo:** `docker-compose.yml:88`

Comentario dice "Set true after confirming Prisma engine writes elsewhere" pero queda en `false`. El filesystem del contenedor es escribible → facilidad para persistencia de malware si hay RCE.

**Solución:** `read_only: true` + `tmpfs` en `/tmp` y paths que Prisma necesite. Los volúmenes (`backend_uploads`, `backend_data`, `backend_backups`) ya están montados.

---

### I7 — Doble `docker-compose.yml` divergiendo

**Archivos:** `docker-compose.yml` (353 líneas, con `nginx-proxy`, `rclone-onedrive`) y `docker-compose.coolify.yml` (189 líneas, sin nginx-proxy ni rclone).

Dos fuentes de verdad. Cambios en uno se olvidan en el otro (el coolify no tiene `logging` limits ni `nginx-proxy`).

**Solución:** un único `docker-compose.yml` + `docker-compose.override.yml` (local) + `docker-compose.coolify.yml` solo como override. Documentar cuál es el canónico.

---

## 🗄️ Base de datos y Prisma

### P1 — Migración del módulo Obras FUERA del pipeline Prisma (⚠️ crítico para entornos limpios)

**Archivos:** `database/migrations/20260629_obras_module/migration.sql` (no trackeada, fuera del dir Prisma) vs `database/prisma/migrations/` (canónico, última: `20260629000000_add_inbox_company_id`).

El `schema.prisma` **ya define** los modelos `Project` (línea 251), `EmployeeProjectWork` (275), `ObraExpense` (293), `ObraImportBatch` (324). Pero la migración que crea esas tablas está en `database/migrations/` (no Prisma) y no trackeada. Un `prisma migrate deploy` en un entorno limpio aplicaría las migraciones trackeadas pero **NO** la de Obras → la DB queda inconsistente con el schema.

**Solución:** mover `database/migrations/20260629_obras_module/migration.sql` a `database/prisma/migrations/20260629000001_add_obras_module/migration.sql` (con `migration_lock.toml` ya existente) y commitear. Verificar con `prisma migrate status` en staging.

---

### P2 — Otras 2 migraciones SQL sueltas fuera de Prisma

**Archivos:** `database/migrations/20260626_add_inventory_image.sql` y `database/migrations/20260626_calendar_recurrence.sql`.

No siguen el formato Prisma (`migration.sql` + `migration_lock.toml`). `prisma migrate deploy` (ejecutado en `entrypoint.sh:26` y CI) **no las aplica**. Los campos `imageUrl`, `recurrence`, `recurrenceEnd` existen en el schema pero la migración real está huérfana.

**Solución:** convertir a migraciones Prisma (`prisma migrate dev --create-only`) con el SQL ya escrito, o verificar que ya se aplicaron manualmente en producción y marcarlas como aplicadas. Eliminar `database/migrations/` (el canónico es `database/prisma/migrations/`).

---

### P3 — Soft-delete solo en `Employee` (inconsistente)

**Archivo:** `database/prisma/schema.prisma:117-119`

`deletedAt`, `deletedById`, `deletionReason` solo en `Employee`. 14 modelos relacionados usan `onDelete: Restrict`, pero `User`, `Company`, `Vehicle` no tienen `deletedAt`. El borrado lógico es parcial y propenso a bugs de filtrado (hay que acordarse de excluir `deletedAt: null` en cada query).

**Solución:** considerar un middleware Prisma que filtre `deletedAt: null` automáticamente en modelos que lo tengan, o añadir `deletedAt` a `User` y `Company` si necesitan retención.

---

### P4 — Modelo `Configuration` key-value sin tipos

**Archivo:** `database/prisma/schema.prisma:777-781`

Modelo key-value genérico (`key String @unique`, `value String`) sin validación de tipos; tentación para guardar JSON en `value` sin schema.

**Solución:** si crece, migrar a modelos tipados. Mientras tanto, documentar el contrato de `value`.

---

## 🧹 Deuda técnica

### D1 — ~800 `any` / `as any` (pérdida de type-safety)

- **Backend:** ~415 `any`/`as any` fuera de tests. Top: `ExcelService.ts` (26), `EmployeeController.ts` (22), `PDIService.ts` (17), `EvaluationService.ts` (14), `EmployeeService.ts` (13).
- **Frontend:** ~138 (`: any` 114, `as any` 11, `<any>` 13). Top: `usePerformance.ts` (9), `CalendarPage.tsx` (4), `reportDataProcessing.ts` (14+).

**Solución por fases:**

1. Empezar por servicios que tocan PII/nómina: `EmployeeService`, `PayrollController`, `ExcelService`, módulo Obras.
2. Sustituir `any` por tipos de Prisma (`Prisma.XxxCreateInput`, `Prisma.XxxWhereInput`).
3. Activar regla `@typescript-eslint/no-explicit-any` como `warn` con budget decreciente, luego `error`.

---

### D2 — `console.*` en código de aplicación

**Backend:** 18 casos en código fuente (270 en scripts debug). Los importantes: `app/health.controller.ts` (1), `app/configValidator.ts` (3), `middlewares/errorMiddleware.ts` (1), `lib/prisma.ts` (1). Ya existe `pino` como logger estructurado.

**Solución:** reemplazar esos 6 `console.*` por `logger.info/error`. Para `scripts/`, mover los one-off a `backend/src/scripts/debug/` o `tools/` fuera de `src`.

---

### D3 — Ficheros backend muy grandes (>700 líneas)

| Fichero                                         | Líneas | Acción                                     |
| ----------------------------------------------- | ------ | ------------------------------------------ |
| `services/documents/DocumentTemplateService.ts` | 880    | Extraer render HTML y variables            |
| `services/EmployeeService.ts`                   | 835    | Separar read-service de write-service      |
| `services/ExcelService.ts`                      | 796    | Separar generadores de reporte por dominio |
| `controllers/CalendarController.ts`             | 555    | Extraer ICS/feed a su propio controller    |
| `controllers/VehicleController.ts`              | 547    | —                                          |
| `controllers/ReportController.ts`               | 535    | —                                          |
| `controllers/PayrollController.ts`              | 512    | —                                          |

---

### D4 — Ficheros frontend muy grandes

| Fichero                                             | Líneas | Acción                                       |
| --------------------------------------------------- | ------ | -------------------------------------------- |
| `pages/CalendarPage.tsx`                            | 1049   | Extraer hooks y sub-componentes (4 overlays) |
| `pages/PerformancePage.tsx`                         | 695    | Por tab                                      |
| `components/DocumentGenerator.tsx`                  | 666    | —                                            |
| `features/employee-import/EmployeeImportWizard.tsx` | 603    | —                                            |

---

### D5 — `window.prompt` en flujo de producción

**Archivo:** `frontend/src/hooks/useEmployeesPage.ts:132`

Usa `prompt('Escribe el nombre del nuevo departamento:')` para cambio masivo de departamento. No es accesible ni estilable.

**Solución:** modal con `ConfirmContext` o input dentro de `ui/Modal`.

---

### D6 — `as any` para forms y hacks `window`

- `CardManager.tsx:195`, `VehicleManager.tsx:248,293`: `e.target.value as any` al setear `type`/`status` — tipos de form pobres.
- `LocationMapModal.tsx:12`: muta `(L.Icon.Default.prototype as any)._getIconUrl` con `delete` — workaround frágil de leaflet que debería aislarse.
- `reportDataProcessing.ts:300`: `rows.reduce((best, row) => ..., null as any)` — oculta null.

**Solución:** tipar los forms con `zod` (ya es dependencia) y aislar el workaround de leaflet en un módulo `lib/leafletIcons.ts`.

---

### D7 — Cobertura de tests desigual

- 63 tests backend, 17 frontend.
- **Bien cubiertos:** Auth, Encryption, Vacation, PayrollAutomation, TimeEntryIdempotency, BreachNotification, Validation, Logger, Queue.
- **Pobremente cubiertos:** Obras (solo parsers), `DocumentTemplateService` (880 LOC), `ExcelService` (796 LOC), control de idempotencia cross-batch (zona con bug C1).

**Solución:** priorizar tests para:

1. `ObraImportController` (upload/preview/commit) — donde está el bug C1.
2. `ObraExpenseController` (create/update/delete, A6 status).
3. Commit de import de empleados — idempotencia + reporte de errores (A3).
4. `PayrollAutomationService` — tasas y proporcion (A5).

---

## 🗑️ Higiene del repositorio

### Directorios de agente/IDE cacheados en git (deberían salir)

Aunque el `.gitignore:137-142` SÍ los ignora, fueron añadidos **antes** de la regla y siguen ocupando espacio en el historial: `.kilo/` (24 archivos), `.kilocode/`, `.mimocode/`, `.sisyphus/`, `.vs/`, `.kilocodemodes`.

**Solución:**

```bash
git rm -r --cached .kilo .kilocode .mimocode .sisyphus .vs .kilocodemodes
```

Considerar `git filter-repo` si el historial es sensible.

---

### Archivos sueltos commiteados que deberían salir

| Fichero                                                                                                           | Acción                                               |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `dummy.pdf` (40 bytes)                                                                                            | Borrar                                               |
| `create_admin.ts` (raíz)                                                                                          | Borrar — duplica `backend/src/scripts/seed-admin.ts` |
| `db_infographic.html`, `pr-body.md`, `templates-analysis.md`, `AUDITORIA_Y_PLAN.md`, `IMPLEMENTATION_COMPLETE.md` | Mover a `docs/historical/` o borrar                  |
| `opencode.json`, `.kilocodemodes`                                                                                 | Borrar (config de herramienta ajena)                 |
| `run-logs/*`, `test/Gestores nacional.csv`                                                                        | `git rm -r --cached` + añadir a `.gitignore`         |
| `backend/src/check_db.ts`                                                                                         | Mover a `scripts/` o eliminar                        |

### Archivos en disco (no trackeados) a limpiar

- `01-login*.png`, `02-dashboard.png`, `mobile-login-test.png` (cubre `.gitignore:60`)
- `flows.html`, `flows.json` (cubre `.gitignore:133-134`)
- `nul` (residuo de Windows, cubre `.gitignore:66-67`)
- `scripts/login.json`, `backend/scripts/login.json` (**credenciales — ver C6**)
- `scripts/preview-override.json`, `preview-presto.json`, `q1.sql`, `test-template.csv`, `proveedores.xlsx`, `seed-admin-inline.js`
- `backend/scripts/obra-test.xlsx`, `seed_invalid_xlsx.ts`

---

### `backend/src/scripts/` con 26 scripts de debug acumulados

`check-counts.ts`, `check-prisma.ts`, `check-user-status.ts`, `check_employees.ts`, `check_user.ts`, `debug-dni.ts`, `debug-login.ts`, `debug_api*.ts`, `find-dni.ts`, `get_payroll_id.ts`, `get_token.ts`, `inspect-pdf-fields.ts`, `restore-employee.ts`, `seed_custom.ts`, `seed_special_test_data.ts`, `seed_test_employees.ts`, `setup_demo.ts`, `temp_seed.ts` (496 líneas), `test_*`, `verify_seed.ts`, `create-mock-template.ts`, `create_test_users.ts`, `deploy_admin.ts`.

**Solución:** mover los que aporten valor diagnóstico a `backend/src/scripts/debug/` con header de uso; eliminar el resto. `temp_seed.ts` y `seed_special_test_data.ts` son candidatos claros a borrado.

### Scripts útiles (mantener)

`scripts/prisma-local.mjs`, `scripts/lint-staged.js`, `scripts/playwright-smoke.mjs` (referenciados en `package.json`); `scripts/backfill-*-encryption.ts`, `scripts/backup-uploads.sh`, `scripts/verify-backups.sh`, `scripts/test-restore-backup.sh`, `scripts/setup-onedrive.sh`, `scripts/generate-secrets.sh`, `scripts/purge-soft-deleted-employees.sh` (operacionales); `backend/src/scripts/seed-admin.ts`, `seed-profiles.ts`, `populate_data.ts` (referenciados en `backend/package.json`).

---

## ✅ Plan de acción priorizado

### 🚨 Sprint 1 — Críticos (impacto inmediato / seguridad)

- [ ] **C1** `var _finalValid` → `let` único (`ObraImportController.ts:416`)
- [ ] **C2** Rama muerta + condición tautológica en `ObraImportService.validate` (`:97-107`)
- [ ] **C3** Conectar limiters a `RedisStore` (`createApp.ts:97`) — `npm i rate-limit-redis`
- [ ] **C5** Eliminar fallback `'system'`/`'anonymous'` en audit log
- [ ] **C6** Eliminar `scripts/login.json` + **rotar `AdminObras2026!`** + `.gitignore`
- [ ] **C7** Pinneo por SHA de Trivy/Trufflehog
- [ ] **C8** Quitar `build-essential` del stage de runtime
- [ ] **P1** Mover migración Obras a `database/prisma/migrations/` + commitear
- [ ] **A3** Añadir errores de chunk a `errors[]` en `EmployeeImportService`

### ⚠️ Sprint 2 — Alto impacto (UX / datos / control interno)

- [ ] **A1** Parsear Excel una vez + persistir + checksum (`ObraImportController`)
- [ ] **A2** Cablear `ensureCanAccess` o eliminar (`obraAuthorization.ts`)
- [ ] **A4** Validar contenido CSV (`fileSecurity.ts` + conectar `checkSuspiciousContent`)
- [ ] **A5** Externalizar tasas IRPF/SS + marcar warnings (`PayrollAutomationService`)
- [ ] **A6** Bloquear `status` en `ObraExpenseController.update`
- [ ] **A7** Min/max explícito de timestamps (`ExcelService`)
- [ ] **A8** Rollback transaccional de inventario (`EPIService`)
- [ ] **A9** `AbortController` en ~40 hooks frontend
- [ ] **A10** Consolidar `extractResponseData` en `api/client.ts`
- [ ] **A11** Refactor de modales hacia `ui/Modal` (empezar por `CalendarPage`, `VacationSelfServiceView`)

### 📈 Sprint 3 — Medio / frontend

- [ ] **M6** Lazy-import de `recharts`
- [ ] **M7** Debounce + cancelación en `Reports.tsx`
- [ ] **M8** Tipar data layer de Reports (`types/reports.ts`)
- [ ] **M9** Persistir `markRead` en backend (`NotificationContext`)
- [ ] **M10** Mover `ConfirmContext.tsx` a `contexts/`
- [ ] **M2/M3** Lockout a nivel servicio + HMAC con pepper para refresh tokens
- [ ] **D5** Reemplazar `window.prompt` por modal

### 🧹 Sprint 4 — Deuda técnica, DB e higiene

- [ ] **D1** Reducir `any` en `ExcelService`, `EmployeeService`, `usePerformance`, `reportDataProcessing`
- [ ] **D2** `console.*` → `logger` (`errorMiddleware`, `prisma.ts`, `configValidator`, `health`)
- [ ] **D3/D4** Split de `DocumentTemplateService`, `EmployeeService`, `CalendarPage.tsx`
- [ ] **C4** Migrar registros CBC legacy a GCM + eliminar rama CBC
- [ ] **P2** Convertir 2 migraciones SQL sueltas a Prisma
- [ ] **P3** Soft-delete consistente (`User`, `Company`) o middleware Prisma
- [ ] **D7** Tests: ObraImportController, ObraExpenseController, idempotencia commit, PayrollAutomation
- [ ] `git rm --cached` de `.kilo/.kilocode/.mimocode/.sisyphus/.vs`
- [ ] Borrar `dummy.pdf`, `create_admin.ts`, `opencode.json`, `.kilocodemodes`
- [ ] Limpiar 26 scripts debug de `backend/src/scripts/`
- [ ] **I2** Cache Buildx en CI · **I3** Job bundle-size · **I4** Job E2E
- [ ] **I5/I6** `USER nginx` + `read_only: true`
- [ ] **I7** Unificar `docker-compose.yml`

---

## 📌 Notas metodológicas

- **Alcance:** análisis estático del código en la rama `feature/modulo-obras` (HEAD `0cad7ed` + working tree changes).
- **Profundidad:** revisión de schemas Prisma, controladores/servicios del módulo Obras, helpers de seguridad (multer/authz/encryption), CI/Docker, y muestreo de patrones transversales (`any`, `console.*`, tamaño de ficheros, error handling, race conditions, modales).
- **Verificado directamente:** `var _finalValid` duplicado (líneas 416/418), `ensureCanAccess` no invocado en ningún sitio, `rate-limit-redis` no instalado, migración Obras fuera de `database/prisma/migrations/`, `login.json` y `database/prisma/.env` no trackeados en git.
- **No incluido:** ejecución de tests, análisis dinámico de runtime, pentest activo.
- **Referencias cruzadas:** los hallazgos C1–C8, A1–A11, M1–M10, I1–I7, P1–P4, D1–D7 incluyen `archivo:línea` para navegación directa.
- **Análisis previos:** `AUDITORIA_Y_PLAN.md` (2026-06-25) cerró 19 tareas; `SOLUCIONES_Y_MEJORAS.md` (2026-07-02) marcó 6 frontend ya resueltos (ver sección correspondiente).

---

_Documento regenerado el 2026-07-14 a partir del análisis del repositorio en `C:\Users\PC\Desktop\RRHH`._
