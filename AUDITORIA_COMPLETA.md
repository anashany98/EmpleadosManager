# 🔍 Auditoría Completa del Proyecto RRHH

> **Fecha:** 2026-07-14  
> **Branch:** `feature/modulo-obras`  
> **Alcance:** Backend (controllers, services), Frontend (React), Base de datos (Prisma/PostgreSQL), Infraestructura (Docker, CI/CD, nginx), Tests y Repository Hygiene  
> **Metodología:** 5 revisiones exhaustivas en paralelo cubriendo ~200 archivos

---

## 📊 Resumen Ejecutivo

| Severidad      | Cantidad | Descripción                                                         |
| -------------- | -------- | ------------------------------------------------------------------- |
| 🔴 **CRÍTICO** | 13       | Exploits de seguridad, corrupción de datos, bugs que causan crash   |
| 🟠 **ALTO**    | 38       | Vulnerabilidades IDOR, bugs funcionales, problemas de diseño graves |
| 🟡 **MEDIO**   | 61       | Inconsistencias, problemas de rendimiento, mejoras de seguridad     |
| 🟢 **BAJO**    | 40       | Higiene de código TypeScript, deuda técnica, nits                   |
| **TOTAL**      | **~152** |                                                                     |

### Áreas más problemáticas

1. **Cross-tenant / IDOR**: Muchos controllers verifican solo `role === 'admin'` (que un admin con `companyId` satisface) en vez de `isGlobalAdmin` + match de empresa → fugas de datos entre compañías
2. **Drift de migraciones**: Existen dos mecanismos de migración paralelos en conflicto
3. **Punto flotante para dinero**: Salarios y nóminas se calculan con `float` en vez de `Decimal`/centros enteros
4. **Tests rotos**: La suite no pasa en checkout limpio; lógica crítica (nómina, contabilidad) sin tests

### Áreas sólidas ✅

- Autenticación: JWT en cookies HttpOnly, rotación de refresh tokens, CSRF, rate-limiting Redis
- PII cifrado: AES-256-GCM con fallback CBC legacy
- Soft-delete GDPR con `onDelete: Restrict`
- `shared/` limpio, política authz bien documentada
- Sin `.js` compilado en `src/`, sin `console.log` en producción

---

## 🔴 HALLAZGOS CRÍTICOS (13)

### SEC-01 · Path traversal en DocumentSignService

- **Archivo:** `backend/src/services/documents/DocumentSignService.ts:19`
- **Categoría:** Seguridad (Path Traversal)
- **Descripción:** `document.fileUrl` se concatena directamente a `path.join(process.cwd(), 'uploads', fileUrl)` sin validación. Si un valor malicioso (`../../etc/passwd`) se almacena en la BD, permite leer archivos arbitrarios del servidor. Otros servicios (`StorageService`, `DocumentLayoutService`) sí tienen esta protección.

```ts
// VULNERABLE:
const filePath = path.join(process.cwd(), 'uploads', document.fileUrl);
pdfBytes = fs.readFileSync(filePath);
```

- **Fix:** Validar que el path resuelto esté dentro de `uploads/` usando `path.resolve()` + comprobación de prefijo, o enrutar a través de `StorageService.getBuffer(key)`.

---

### SEC-02 · DocumentTemplateController.sign sin autorización (IDOR)

- **Archivo:** `backend/src/controllers/DocumentTemplateController.ts:312-323`
- **Categoría:** Seguridad (IDOR)
- **Descripción:** El endpoint `sign` acepta un `documentId` arbitrario y firma el documento **sin verificar** que el usuario tenga relación con ese documento o su empleado/empresa. Cualquier usuario autenticado puede firmar cualquier documento del sistema enumerando IDs.
- **Fix:** Resolver el documento → verificar `employee.companyId` contra el usuario → autorizar con `authorize('document.write', ...)` antes de firmar.

---

### SEC-03 · CalendarController.getFeed reutiliza JWT_SECRET como clave HMAC

- **Archivo:** `backend/src/controllers/CalendarController.ts:36-47, 50-79`
- **Categoría:** Seguridad (Crypto)
- **Descripción:** El feed de calendario usa `HMAC-SHA256(JWT_SECRET, employeeId)` como credencial de acceso permanente, devuelto en el body JSON y embebido en la URL (`&s=signature`). Problemas: (1) JWT_SECRET se reutiliza como clave MAC — si se rota, todos los feeds se rompen; (2) la firma aparece en URLs que se loguean en proxies/Referer.
- **Fix:** Usar `CALENDAR_FEED_SECRET` dedicado. Generar tokens aleatorios por empleado almacenados hash en BD (como refresh tokens), no HMAC determinista de employeeId.

---

### SEC-04 · KioskController.clockIn — el PIN del kiosk es la contraseña de login

- **Archivo:** `backend/src/controllers/KioskController.ts:109-189`
- **Categoría:** Seguridad
- **Descripción:** (1) El kiosk autentica comparando `pin` contra `user.password` con `bcrypt.compare` — el PIN de 4-6 dígitos es la **contraseña completa** de la cuenta. (2) El rate-limit usa `kiosk:pin:${employeeId}:${ip}` — rotar IPs evita el límite de 5 intentos. (3) Un atacante puede bloquear a una víctima (DoS) forzando intentos desde múltiples IPs.
- **Fix:** PIN de kiosk separado del password de login. Rate-limitar por `employeeId` globalmente (no solo por IP). Considerar TOTP/códigos de corta duración.

---

### SEC-05 · Kiosk device "secret" embebido en el bundle del frontend

- **Archivo:** `frontend/src/pages/Kiosk/KioskPage.tsx:7` + `.env`
- **Categoría:** Seguridad
- **Descripción:** `VITE_KIOSK_DEVICE_SECRET` se lee via `import.meta.env` y se envía como header `x-kiosk-secret`. Toda variable `VITE_`-prefixed se **inlinea en el bundle JS del cliente**, así que el "secret" es visible para cualquiera que descargue el JS.
- **Fix:** Tratar el endpoint de kiosk como no-autenticado-pero-rate-limited, o autenticar via login por dispositivo que genere una cookie HttpOnly.

---

### BUG-01 · TimeTrackerWidget — recursión infinita en getErrorMessage

- **Archivo:** `frontend/src/components/TimeTrackerWidget.tsx:73-79`
- **Categoría:** Bug (Crash)
- **Descripción:** Una función local `getErrorMessage` sombrea la importada de `api/client`. Su rama fallback se llama a sí misma → **stack overflow** cuando se pasa un valor que no es `Error` o un `Error` con mensaje vacío. Se dispara en el catch de line 303 (cualquier error de fichaje que no sea networkError).

```ts
function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return getErrorMessage(error, 'Error al fichar'); // ❌ recursión infinita
}
```

- **Fix:** Renombrar la función local o usar alias en la importación (`import { getErrorMessage as apiGetErrorMessage }`).

---

### BUG-02 · Dinero en punto flotante (salarios y nóminas)

- **Archivos:** `backend/src/services/SalaryEncryption.ts:39-63,96`, `PayrollAutomationService.ts:130-141`
- **Categoría:** Bug (Financiero)
- **Descripción:** Los salarios se desencriptan a `number` (parseFloat) y luego se multiplican/dividen como floats antes de re-envolverlos en `Prisma.Decimal`. Binary64 no puede representar la mayoría de valores decimales exactamente (`0.1+0.2=0.30000000000000004`), causando drift acumulativo en nóminas, SS, IRPF.

```ts
const num = typeof value === 'number' ? value : parseFloat(String(value));
const bruto = new Prisma.Decimal(monthlySalary * salaryFactor); // Decimal desde float
```

- **Fix:** Mantener dinero como centavos enteros o `Prisma.Decimal` end-to-end. Operar con `.mul()` sobre Decimal construido desde string de centavos.

---

### DATA-01 · Import de obras sin idempotencia transaccional (race condition)

- **Archivo:** `backend/src/controllers/ObraImportController.ts:421-465`
- **Categoría:** Integridad de datos
- **Descripción:** El check de duplicados cross-batch (lines 393-417) consulta expenses existentes **fuera** de la transacción, luego inserta dentro de `$transaction`. Dos commits concurrentes pueden pasar ambos el check de `reference` duplicada e insertar el mismo `obraId::reference`. No hay `SELECT FOR UPDATE` ni constraint único.
- **Fix:** Mover el check de duplicados dentro de la transacción (usando el client `tx`). Añadir constraint único en `(obraId, reference)`. Capturar `P2002`.

---

### DATA-02 · Inventario + documento + asset creation no atómico

- **Archivos:** `backend/src/services/documents/EPIService.ts:14-55`, `UniformService.ts:13-57`, `TechDeviceService.ts:13-58`, `MaterialDeliveryService.ts:41-82`
- **Categoría:** Integridad de datos
- **Descripción:** Cuatro pasos no transaccionales: (1) generar PDF + documento, (2) decrementar stock, (3) crear asset. Si el insert de asset falla tras el movimiento, el stock se decrementó pero no hay asset registrado. `recordMovement` también hace dos writes fuera de transacción.
- **Fix:** Envolver movimiento + item update en `prisma.$transaction`. Envolver documento-create + movimiento + asset-create en una transacción.

---

### MIGR-01 · Drift de migraciones: módulo Obras duplicado

- **Archivos:** `database/migrations/20260629_obras_module/migration.sql` **Y** `database/prisma/migrations/20260629000001_add_obras_module/migration.sql`
- **Categoría:** Migración
- **Descripción:** El módulo Obras completo existe como SQL byte-idéntico en dos sitios: el directorio legacy (`database/migrations/`) Y la migración Prisma. Los archivos `.sql` legacy no son trackeados por ningún runner. Ejecutar los `.sql` manuales causa errores `relation already exists`.
- **Fix:** Eliminar `database/migrations/20260629_obras_module/` y los `.sql` legacy. La migración Prisma es la fuente de verdad.

---

### MIGR-02 · Drift de migraciones: `imageUrl` y `recurrence` sin migración Prisma

- **Archivos:** `database/migrations/20260626_add_inventory_image.sql`, `database/migrations/20260626_calendar_recurrence.sql` ↔ `schema.prisma:734,1219`
- **Categoría:** Migración
- **Descripción:** Estas columnas existen en `schema.prisma` y en `.sql` legacy, pero **ninguna migración Prisma las crea**. Una BD fresca creada via `prisma migrate deploy` (como hace CI, line 116) estará **missing** estas columnas → errores `column does not exist` en runtime.
- **Fix:** Generar migración Prisma para estas dos columnas (solo crear el archivo, **no ejecutar**). Luego borrar los `.sql` legacy.

---

### HYGIENE-01 · Password admin hardcoded en script seed

- **Archivo:** `scripts/seed-admin-inline.js:7` (untracked)
- **Categoría:** Seguridad / Higiene
- **Descripción:** Contiene `process.env.SEED_ADMIN_PASSWORD || 'AdminObras2026!'` para `admin@admin.com` con permisos full admin, bcrypt cost 10 (bypass de `getBcryptRounds()`). A diferencia del seguro `backend/src/scripts/seed-admin.ts` (que rechaza defaults débiles), este variant silenciosamente crea un superuser con credenciales conocidas.
- **Fix:** Borrar `scripts/seed-admin-inline.js`. Reusar `backend/src/scripts/seed-admin.ts`.

---

### TEST-01 · Tests rotos: VacationRequestService no rechaza vacaciones sobre quota

- **Archivo:** `backend/src/services/VacationRequestService.test.ts:244`
- **Categoría:** Testing / Bug funcional
- **Descripción:** `AssertionError: promise resolved instead of rejecting`. El test espera que el servicio rechace solicitudes de vacaciones que excedan la quota anual, pero **el servicio las acepta**. Bug de política real: los empleados pueden solicitar más vacaciones de las permitidas.
- **Fix:** Fixear la lógica de quota-check en `VacationRequestService` (probable regresión por cambios del working tree).

---

## 🟠 HALLAZGOS ALTOS (38)

### Seguridad — Cross-tenant / IDOR (14 hallazgos)

| ID         | Archivo                                                   | Problema                                                                                                                                                        |
| ---------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SEC-06** | `TimeEntryController.ts:241-285`                          | `createManual`: un usuario **HR** (role `hr`) nunca se verifica → puede crear entradas de fichaje para cualquier empleado de cualquier empresa                  |
| **SEC-07** | `EmployeeDashboardController.ts:17-24`                    | Un usuario no-admin sin `companyId` termina con `where` vacío → devuelve métricas (headcount, nombres, departamentos) de **todas las empresas**                 |
| **SEC-08** | `EvaluationController.ts:7-14,74-81,161-187`              | `create`/`update`/`createBulk`/`getStats` sin check de autorización. `getById` verifica solo `role==='admin'` → admin de empresa A ve evaluaciones de empresa B |
| **SEC-09** | `ObjectiveController.ts:42-94` & `PDIController.ts:30-78` | `isAdmin = role==='admin'` da acceso cross-tenant a admin con companyId. `create`/`delete`/`getOverdue` sin auth check                                          |
| **SEC-10** | `OvertimeController.ts:68-404`                            | Ningún endpoint tiene autorización ni scoping de empresa. `importOvertime` **borra TimeEntries** de empleados arbitrarios por DNI                               |
| **SEC-11** | `InboxController.ts:64-79`                                | `assign` sin verificación de empresa del documento ni del empleado destino                                                                                      |
| **SEC-12** | `AnomalyController.ts:18-109`                             | `getAll`/`getByEmployee`/`updateStatus` sin scoping de empresa                                                                                                  |
| **SEC-13** | `InventoryController.ts:179-309`                          | `distribute`/`generateReceipt` sin verificar que employeeId pertenece a la empresa del caller                                                                   |
| **SEC-14** | `OnboardingController.ts:11-29`                           | `startOnboardingProcess` sin `canManageEmployee` check                                                                                                          |
| **SEC-15** | `VacationController.ts:161`                               | `status` controlado por cliente: `(req.body as any).status \|\| 'PENDING'` → auto-aprobación de vacaciones                                                      |
| **SEC-16** | `ReportController.ts:458-510`                             | `companyId` calculado pero no pasado a `filters` del service → reportes cross-tenant                                                                            |
| **SEC-17** | `UserController.ts:87-176`                                | `update` no incrementa `sessionVersion` al cambiar password → sesiones antiguas siguen válidas. `delete` hard-deletea sin audit log                             |
| **SEC-18** | `DocumentController.ts:54-108`                            | `/documents/ocr` sin `authorize` middleware ni scoping de empresa                                                                                               |
| **SEC-19** | `ConsentController.ts:76-101`                             | `purpose` del body no validado contra `CONSENT_PURPOSES`                                                                                                        |

> **Fix general para SEC-06 a SEC-19:** Cambiar todos los checks `role === 'admin'` por `isGlobalAdmin(user) || (user.companyId === target.companyId)`. Añadir checks de `canManageEmployee` en controllers destructivos. Forzar `status='PENDING'` salvo permiso `vacation.manage`.

---

### Seguridad — Otros (3 hallazgos)

| ID         | Archivo                           | Problema                                                                                                                                                                        |
| ---------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SEC-20** | `ObraExpenseController.ts:61-102` | `create`: sin validación de `amount` (puede ser NaN/negativo), `type` (no validado contra enum), `date`. `status` hardcoded a `'APPROVED'` saltándose el workflow de aprobación |
| **SEC-21** | `InboxService.ts:151-164`         | Password IMAP almacenado en plaintext en `configuration` table (no pasa por `EncryptionService`)                                                                                |
| **SEC-22** | `DocumentPreview.tsx:152-153`     | `<iframe src={fullUrl}>` sin atributo `sandbox` → el PDF viewer corre same-origin con acceso a cookies                                                                          |

---

### Bugs funcionales (8 hallazgos)

| ID         | Archivo                                           | Problema                                                                                                                                                                           |
| ---------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ----- | --- | ---------------------------------------------------------------------------------------------------------- |
| **BUG-03** | `AnomalyService.ts:8,56-60,86-113`                | Comparaciones de tiempo con `getHours()` usan la **timezone del servidor**, no UTC ni la del empleado → falsos positivos de off-hours                                              |
| **BUG-04** | `HealthChecker.ts:272-273`                        | Lógica de status de memoria **invertida**: `>90 ? 'degraded' : >95 ? 'error' : 'ok'` → nunca reporta `error`                                                                       |
| **BUG-05** | `ReportScheduler.ts:107-123`                      | `case 'attendanceSummary'` duplicado — el segundo case es **unreachable**. `attendanceSummary` siempre ejecuta el reporte detallado, nunca el summary                              |
| **BUG-06** | `OnboardingService.ts:2,38-123`                   | Importa `DocumentTemplateService` (stub raíz de 50 líneas) esperando métodos que no existen (`generateNDA`, `generateUniform`). Las implementaciones reales están en `documents/*` |
| **BUG-07** | `AnalyticsService.ts:65-74,165-174`               | Usa `updatedAt` como proxy de fecha de baja → sobre-cuenta salidas (cualquier edit a un ex-empleado lo cuenta como baja reciente). Debería usar `exitDate`                         |
| **BUG-08** | `ObraImportService.ts:11` vs `valueParsers.ts:83` | Fórmulas de fecha Excel-serial diferentes: una omite `Math.round`, causando que la misma fecha parseé a valores distintos según importer                                           |
| **BUG-09** | `CalendarService.ts:39-51`                        | Holidays hardcoded solo para 2026. En 2027 desaparecen silenciosamente                                                                                                             |
| **BUG-10** | `EncryptionService.ts:111-114`                    | `decrypt` retorna `null` en fallo; callers hacen `                                                                                                                                 |     | ''`/` |     | '-'` → un ciphertext corrupto o key rotada se convierte silenciosamente en DNI/IBAN vacío en PDFs/reportes |

---

### Integridad de datos / Rendimiento (8 hallazgos)

| ID          | Archivo                             | Problema                                                                                                                                                                             |
| ----------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **DATA-03** | `VacationBalanceService.ts:208-310` | Recursión de carryover sin límite + cache `new Map()` por llamada → una lectura del año actual recorre toda la historia del empleado recursivamente                                  |
| **DATA-04** | `PayrollController.ts:349-401`      | `createManualPayroll`: batch find-then-create sin transacción → requests concurrentes crean batches duplicados para el mismo mes/empresa                                             |
| **DATA-05** | `VacationRequestService.ts:55-70`   | "Pedir prestado del año siguiente" sin guard transaccional → dos requests concurrentes double-advance                                                                                |
| **DATA-06** | `NotificationService.ts:14-52`      | `create`/`notifyAdmins` swallow errores (catch + log) → flujos de aprobación prosiguen sin saber que no se creó notificación                                                         |
| **DATA-07** | `BackupService.ts:46-273`           | I/O síncrono (`readFileSync`/`writeFileSync`) bloquea el event loop en backups de cientos de MB                                                                                      |
| **DATA-08** | `EmployeeImportService.ts:340-358`  | Update path: borra contactos de emergencia, los recrea solo si `contactName \|\| contactPhone` → contacts perdidos si vienen via nested path pero las variables locales están vacías |
| **DATA-09** | `AuthService.ts:29-35`              | Sin lockout/incremento de intentos fallidos en login. `lockedUntil` existe pero nada lo escribe aquí                                                                                 |
| **DATA-10** | `RedisRateLimiter.ts:48-53,82-85`   | Fail-open hardcoded: si Redis cae, **todos** los rate-limits se desactivan                                                                                                           |

---

### Frontend (5 hallazgos)

| ID        | Archivo                                                                     | Problema                                                                                                                             |
| --------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **FE-01** | `VehicleManager.tsx:147`, `CardManager.tsx:97`                              | `window.confirm()` nativo para acciones destructivas — inconsistente con el `useConfirm()` pulido del resto de la app                |
| **FE-02** | `ObrasPage.tsx:82`, `ObraDetailPage.tsx:89`                                 | `useEffect` sin AbortController → race condition al paginar rápido, datos stale sobreescriben recientes                              |
| **FE-03** | `NotificationBell.tsx:16-53`                                                | Polling independiente de `/notifications` cada 30s duplica el `NotificationContext` (EventSource SSE) → dos fuentes de verdad, drift |
| **FE-04** | `DocumentArchive.tsx:38-40`                                                 | `useEffect` con `fetchDocuments` no memoizado + missing dependency → eslint exhaustive-deps                                          |
| **FE-05** | `VehicleManager.tsx:81-86`, `CardManager.tsx:36-43`, `DocumentsSection:374` | Delete mutations con `confirm()` nativo y sin feedback optimista                                                                     |

---

### Infraestructura (5 hallazgos)

| ID           | Archivo                                        | Problema                                                                                                                               |
| ------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **INFRA-01** | `docker-compose.coolify.yml:68`                | `RUN_PRISMA_MIGRATIONS=true` → migraciones corren en **cada** boot del contenedor. Multi-replica deploy = race condition               |
| **INFRA-02** | `docker-compose.yml:328-332`                   | Red `coolify` declarada `external: true` en compose base → `docker compose up` standalone falla                                        |
| **INFRA-03** | `.env.example:37` vs `backend/.env.example:38` | `COOKIE_SAMESITE` discrepa: root dice `strict`, backend dice `lax`. `csrfMiddleware.ts:16` ignora el env var y fuerza `strict` en prod |
| **INFRA-04** | `schema.prisma:999`                            | `Card.pin String?` — PIN almacenado como texto plano en schema (sin `*Enc`). PCI DSS §3.2 prohíbe retener PINs                         |
| **INFRA-05** | `schema.prisma:315,337`                        | `ObraExpense.createdById` y `ObraImportBatch.createdById` con `onDelete: NoAction` → delete de User falla o deja huérfanos             |

---

### Testing (3 hallazgos)

| ID          | Archivo                                                 | Problema                                                                                                                                                                   |
| ----------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TEST-02** | `backend/src/tests/authz.test.ts:244`                   | `expected true to be false` — manager con `assets:write` se le niega `fleet`, pero `COMPANY_STAFF_DEFAULTS` le concede `fleet:write`. Policy drift                         |
| **TEST-03** | Múltiples archivos de test                              | **48 tests fallan** en checkout limpio: integration tests necesitan PostgreSQL+Redis sin `vi.mock` ni `skipIf`. `npm test` es rojo en cualquier máquina sin stack completo |
| **TEST-04** | `backend/src/services/documents/DocumentSignService.ts` | Firma de documentos (legalmente sensible) con **cero tests**                                                                                                               |

---

## 🟡 HALLAZGOS MEDIOS (61)

### Backend — Controllers (18)

| ID         | Archivo                                | Problema                                                                                                                                |
| ---------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **MID-01** | `AssetController.ts:169-182`           | `update` sobreescribe todos los campos; `status` se toma verbatim del body sin validar contra enum                                      |
| **MID-02** | `AssetController.ts:222-231`           | Si `InventoryService.returnAsset` falla durante delete, el error se loguea y el asset se borra igual → stock drift                      |
| **MID-03** | `InboxController.ts:81-114`            | `fs.renameSync`/`mkdirSync` (bloqueante). `processFile` fire-and-forget → upload returns 200 incluso si processing crashea              |
| **MID-04** | `ObraController.ts:49-54`              | `status` filter silenciosamente fuerza `ACTIVE` para cualquier valor no-{ACTIVE,INACTIVE}                                               |
| **MID-05** | `ObraImportController.ts:260-269`      | `preview` retorna `_cached` completo (todas las filas válidas+inválidas) en la respuesta HTTP                                           |
| **MID-06** | `PayrollController.ts:433`             | `canReadPayroll` llamado con fallbacks empty-string que pueden always-allow                                                             |
| **MID-07** | `InsightController.ts:156-180`         | Carga **todos** los empleados en memoria para calcular aniversarios                                                                     |
| **MID-08** | `InventoryController.ts:99-116`        | `unitPrice` no se coerce a Number en update (sí en create). Cambios de quantity via update no generan movement log                      |
| **MID-09** | `CalendarController.ts:458-467`        | N+1: un `prisma.employee.count` por departamento dentro del loop                                                                        |
| **MID-10** | `CalendarController.ts` (7 sitios)     | `catch {}` blocks que loguean string estático y descartan el error real                                                                 |
| **MID-11** | `ExpenseController.ts:17-81`           | `createWorker('spa')` por request (memory leak). Reusar singleton como DocumentController                                               |
| **MID-12** | `AuditController.ts:53-57`             | `include: { user: true }` retorna registro completo de user (posible hash password, PII). Sin paginación                                |
| **MID-13** | `ObraController.ts:106-147`            | `getById` retorna **todos** los expenses y employeeWork sin paginación (unbounded payload)                                              |
| **MID-14** | `AuditService.ts:271`                  | `limit` sin upper bound → caller puede pasar `1000000`                                                                                  |
| **MID-15** | `EvaluationService.ts:220-289`         | `score \|\| 0` trata un score legítimo de 0 igual que "no evaluado" → arrastra el promedio. Cálculo duplicado en 2 métodos              |
| **MID-16** | `PayrollAutomationService.ts:129-141`  | IRPF flat 15% (debería ser progresivo). `4.33` semanas/mes es aproximación que drift. Marca rows como `'VALID'` cuando son estimaciones |
| **MID-17** | `employeeImport/excelFileParser.ts:61` | Detección de magic number solo detecta `PK` (xlsx). `.xls` (BIFF, `0xD0CF`) se rutea a CSV parser → garbage                             |
| **MID-18** | `BackupService.ts:48-57`               | Si `unlinkSync` falla tras encriptar, el dump plaintext queda en disco junto al `.enc`                                                  |

### Backend — Services (9)

| ID         | Archivo                          | Problema                                                                                                 |
| ---------- | -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **MID-19** | `RedisRateLimiter.ts`            | Fail-open hardcoded sin flag configurable                                                                |
| **MID-20** | `ExcelService.ts` (múltiple)     | Access a `.dni` sin verificar que siempre pasa por `decrypt` — riesgo de leak PII en exports             |
| **MID-21** | `InboxService.ts:184`            | Attachments escritos con `fs.writeFileSync` (bloqueante). IMAP sin backoff en failure                    |
| **MID-22** | `NotificationProducer.ts:32-167` | N+1: un `user.findMany` por empleado en batch de 500. `include: { company: true }` fetched pero no usado |
| **MID-23** | `CacheService.ts:33-49`          | LRU O(n): `Array.filter` sobre 500 entries en cada get/set/del                                           |
| **MID-24** | `NotificationStream.ts:8-52`     | SSE sin heartbeat, sin max-clients-per-user, sin cleanup de half-closed sockets                          |
| **MID-25** | `PayrollPdfService.ts:148`       | `_formatMoney` dead code. `Math.abs(totalDevengos).toFixed(2)` oculta errores de signo                   |
| **MID-26** | `AnomalyService.ts:163-170`      | Check de duplicados ignora `currency` y usa match exacto de amount → false positives/negatives           |
| **MID-27** | `ReportScheduler.ts:231`         | `filePath: /uploads/${key}` hardcoded → wrong URL cuando `STORAGE_PROVIDER=s3`                           |

### Frontend (12)

| ID        | Archivo                                         | Problema                                                                                                                                                |
| --------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FE-06** | `useSocket.ts:4-36`                             | Socket singleton sin cleanup; si desconecta permanentemente (5 intentos) se queda muerto sin señal UI                                                   |
| **FE-07** | `LockContext.tsx` + `useLockPolling.ts`         | Dos implementaciones de locking paralelas (Socket vs HTTP polling). `useLockPolling` calcula `timeRemaining` con posible NaN si expiresAt es ISO string |
| **FE-08** | `CommandPalette.tsx:133-188`                    | Búsqueda debounced sin AbortController → responses stale sobrescriben recientes. `.catch(() => ({data:[]}))` traga errores                              |
| **FE-09** | ~50 archivos                                    | Uso pervasive de `any`: `DocumentArchive`, `ObrasPage`, `CardManager`, `VehicleManager`, `usePerformance`, widgets                                      |
| **FE-10** | `CardManager.tsx:143`, `VehicleManager.tsx:213` | Deswrap inconsistente: `res.data?.data \|\| res.data \|\| []` vs `normalizeApiCollection<any>(res)`                                                     |
| **FE-11** | `Sidebar.tsx:23-38`                             | `resize` listener nativo en vez de `matchMedia` (inconsistente con App.tsx que fue refactorizado a matchMedia)                                          |
| **FE-12** | `Header.tsx:31-36`                              | Redundante sync de tema: dos writers a `localStorage.theme` (Header + App)                                                                              |
| **FE-13** | `ConfirmContext.tsx:39-43`                      | Event listener re-subscribe en cada cambio de `dialogConfig`                                                                                            |
| **FE-14** | `Modal.tsx:25-28`                               | Focus management corre antes de que children render → focusableElements vacío                                                                           |
| **FE-15** | `CommandPalette.tsx:119`                        | `setTimeout(focus, 100)` magic delay para animación                                                                                                     |
| **FE-16** | `AlertCenter.tsx:131-132`                       | Componentes SVG inline definidos dentro del render body → recreated cada render                                                                         |
| **FE-17** | `NotificationContext.tsx:47`                    | EventSource sin reconnect backoff/visibility handling                                                                                                   |

### Base de datos / Schema (10)

| ID        | Archivo                                                                      | Problema                                                                                                                              |
| --------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **DB-01** | `schema.prisma` — MedicalReview, Training, AccountingEntryLine, Notification | FK columns sin `@@index`: `employeeId` (MedicalReview, Training), `entryId` (AccountingEntryLine), `userId` (Notification — hot path) |
| **DB-02** | `schema.prisma:451-452`                                                      | `Vacation` tiene ambos `type String` Y `absenceType AbsenceType` — redundante, drift risk                                             |
| **DB-03** | `schema.prisma` — User.role, Expense.status/category, Asset.status, etc.     | Muchos status/type/category como `String` en vez de enum → sin integridad DB-level. Role typo bypassa auth checks                     |
| **DB-04** | `schema.prisma:961,728`                                                      | `VehicleLog.cost`, `InventoryItem.unitPrice`: nullable + default 0 → dos representaciones de "sin valor"                              |
| **DB-05** | `schema.prisma:893`                                                          | `AnomalyEvent @@unique([entityType, entityId])` → solo 1 anomaly por entidad ever. Re-scan post-resolución conflictúa                 |
| **DB-06** | `schema.prisma` — User.email, Employee.dni/email/phone                       | PII sin length caps ni `@db.VarChar(N)` → storage-abuse vector                                                                        |
| **DB-07** | `schema.prisma:802`                                                          | `Notification` table sin TTL/purge job + userId sin index → crece unbounded                                                           |
| **DB-08** | `schema.prisma:1273-1293`                                                    | `Consent` sin index compuesto en `(employeeId, purpose, granted)`                                                                     |
| **DB-09** | `schema.prisma:577-625`                                                      | Payroll/Accounting money columns son `Decimal` sin `@db.Decimal(15,2)` → mapean a `DECIMAL(38,10)` por defecto                        |
| **DB-10** | `schema.prisma:154,281`                                                      | `weeklyHours` y `EmployeeProjectWork.hours` usan `Float` — aceptable para display, problemático para cálculos de nómina               |

### Infraestructura / CI (8)

| ID           | Archivo                          | Problema                                                                                                                                           |
| ------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **INFRA-06** | `frontend/Dockerfile:50-53`      | nginx master process corre como root (sin `USER nginx` ni unprivileged port)                                                                       |
| **INFRA-07** | `ci-cd.yml:229-236`              | Trivy scan escribe SARIF pero sin `exit-code: '1'` → CVEs críticos no rompen CI                                                                    |
| **INFRA-08** | `ci-cd.yml:200-218`              | Builds usan `docker build` plano en vez de Buildx cache-from/cache-to. `setup-buildx` importado pero no usado. Imágenes nunca escaneadas por Trivy |
| **INFRA-09** | `docker-compose.yml:88`          | `read_only: false` con TODO comment — filesystem escribible debilita container escape posture                                                      |
| **INFRO-10** | `docker-compose.yml:227-265,277` | Backup y rclone-onedrive sin resource limits                                                                                                       |
| **INFRA-11** | `Dockerfiles`                    | Pin a `node:22.12-bullseye` (patch específico, Debian 11 viejo). Debería ser `node:22-bookworm-slim`                                               |
| **INFRA-12** | `ci-cd.yml` Trivy step           | Trivy `fs` scan escanea repo, no imágenes Docker built → miss vulnerabilidades de layers                                                           |
| **INFRA-13** | `csfrMiddleware.ts:22-29`        | `/api/auth/refresh` exento de CSRF — refresh token cookie es replayable cross-site                                                                 |

### Testing / Hygiene (4)

| ID             | Archivo                                                                          | Problema                                                                                                                |
| -------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **TEST-05**    | `backend/src/controllers/PayrollController.ts` (512 LOC), `AccountingService.ts` | Lógica crítica de nómina/contabilidad con **cero tests**. Invariantes (neto≤bruto, debe==haber) sin verificar           |
| **HYGIENE-02** | `backend/src/scripts/` (~30 archivos)                                            | Scripts debug/scratch (`debug-login`, `check_db`, `find-dni`, `temp_seed`) en version control junto a código producción |
| **HYGIENE-03** | `.kilo/`, `.kilocode/`, `.mimocode/`                                             | ~194MB de tooling dirs. `.kilo/worktrees/` contiene copia completa del backend → vitest corre **cada test dos veces**   |
| **HYGIENE-04** | `README.md:63,183`                                                               | Dice que la BD es SQLite (es PostgreSQL). Encoding UTF-8 corrupto (mojibake). Dice jsPDF (es pdf-lib)                   |

---

## 🟢 HALLAZGOS BAJOS (40)

### TypeScript / Higiene de código (15)

| ID         | Patrón                                                                                                                                 | Dónde                                                                                                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LOW-01** | Uso pervasive de `any`: `Record<string, any>`, `let where: any`, `data: any[]`, `(v: any)`, `payload: any`                             | ObraImportController, AssetController, PayrollController, InventoryController, CalendarController, EvaluationService, ExcelService, DocumentArchive, ObrasPage, CardManager, VehicleManager (~50 archivos) |
| **LOW-02** | `err.message` retornado directo al cliente en non-AppError → leak de internals DB                                                      | EmployeeController, AuthController, PayrollController, ObraImportController                                                                                                                                |
| **LOW-03** | 3 patrones de error-handling inconsistentes: (a) catch→ApiResponse.error, (b) throw/next, (c) res.status(500).json raw                 | Cross-cutting                                                                                                                                                                                              |
| **LOW-04** | `ObraExpenseController.delete:163` ignora `AppError.statusCode` → siempre retorna 500                                                  | ObraExpenseController                                                                                                                                                                                      |
| **LOW-05** | `FileController.ts:7-38` sirve cualquier archivo de `uploads/` a cualquier usuario autenticado (IDOR potencial)                        | FileController                                                                                                                                                                                             |
| **LOW-06** | `DocumentTemplateController.uploadLogo` sin validar tipo/size de archivo                                                               | DocumentTemplateController                                                                                                                                                                                 |
| **LOW-07** | OffboardingController.confirmOffboarding hard-desactiva empleado sin verificación de empresa                                           | OffboardingController                                                                                                                                                                                      |
| **LOW-08** | `CardController.create:34,136` — `encryptedPan` set desde body sin step de encriptación                                                | CardController                                                                                                                                                                                             |
| **LOW-09** | ConfigController/AbsenceTypeConfigController escriben arbitrary key/value sin allow-list                                               | ConfigController                                                                                                                                                                                           |
| **LOW-10** | `VehicleController.getAll` retorna `employee: true` completo + todos los documents sin paginación                                      | VehicleController                                                                                                                                                                                          |
| **LOW-11** | `ContractService.ts`, `ReportService.ts` (root), `DocumentTemplateService.ts` (root) — stubs vacíos que shadow implementaciones reales | Services root                                                                                                                                                                                              |
| **LOW-12** | `ExcelService.ts:487` — reduce sobre array vacío con `data[0]` en accumulator                                                          | ExcelService                                                                                                                                                                                               |
| **LOW-13** | `AuditService.ts:271` — `limit` sin upper bound forwarded a Prisma `take`                                                              | AuditService                                                                                                                                                                                               |
| **LOW-14** | `TimeTrackerWidget.tsx:289` — `geoError instanceof GeolocationPositionError` frecuentemente retorna false (no es constructible)        | TimeTrackerWidget                                                                                                                                                                                          |
| **LOW-15** | `LoginPage.tsx:64-72` — `JSON.parse(error.message)` frágil; debería usar `getErrorMessage`                                             | LoginPage                                                                                                                                                                                                  |

### Diseño / Nits (25)

| ID         | Descripción                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **LOW-16** | `errorMiddleware` siempre retorna `AppError.message` verbatim en todos los entornos                                             |
| **LOW-17** | `auditMiddleware.ts:61-65` — `securityAuditMiddleware()` es stub vacío (solo `next()`)                                          |
| **LOW-18** | `.editorconfig` + múltiples dirs AI (`.kilo`, `.kilocode`, `.mimocode`, `.sisyphus`) committed en root                          |
| **LOW-19** | `CardManager.tsx:209` — input `panLast4` sin validación digits-only                                                             |
| **LOW-20** | `ObraDetailPage.tsx:53` — `useParams` sin null-guard antes de handlers                                                          |
| **LOW-21** | `App.tsx:80` — `useState(window.innerWidth > 768)` sin guard `typeof window`                                                    |
| **LOW-22** | `OnboardingWizard.tsx:29` y muchos — `useEffect(() => { loadX(); }, [])` con missing dep                                        |
| **LOW-23** | `useLockPolling.ts:39` — interval se resetea en cada cambio de userId                                                           |
| **LOW-24** | `AccountingEntry/PayrollRow/PayrollItem` money sin `@db.Decimal(15,2)` (ver DB-09)                                              |
| **LOW-25** | `schema.prisma` — `updatedAt` inconsistente: algunos `@default(now()) @updatedAt`, otros solo `@updatedAt`                      |
| **LOW-26** | `.env` concrets locales débiles pero etiquetados (`JWT_SECRET=local_jwt_secret_change_me`)                                      |
| **LOW-27** | `nul` (Windows reserved name accident) + `Beamng/` (dir de juego) localmente                                                    |
| **LOW-28** | Múltiples `.md` de planning en root: `AUDITORIA_Y_PLAN.md`, `IMPLEMENTATION_COMPLETE.md`, `templates-analysis.md`, `pr-body.md` |
| **LOW-29** | `dummy.pdf` (40 bytes) tracked en repo root                                                                                     |
| **LOW-30** | Solo 1 TODO en todo el codebase — notablemente limpio de deuda técnica explícita                                                |
| **LOW-31** | `BackendService`... (ver agent reports para nits específicos restantes)                                                         |

> Los hallazgos LOW restantes son nits específicos de cada archivo con bajo impacto. Consulta los reportes de los agentes individuales para detalle completo.

---

## 📋 Plan de Acción por Sprints

### Sprint 0 — Hotfixes inmediatos (pocos cambios, alto impacto)

| #   | Tarea                                                                                     | Esfuerzo | Riesgo  |
| --- | ----------------------------------------------------------------------------------------- | -------- | ------- |
| 0.1 | **BUG-01**: Fix recursión infinita `getErrorMessage` en TimeTrackerWidget                 | 5 min    | Ninguno |
| 0.2 | **BUG-04**: Invertir thresholds en `HealthChecker.checkMemory`                            | 2 min    | Ninguno |
| 0.3 | **BUG-05**: Fix `case 'attendanceSummary'` duplicado en ReportScheduler                   | 5 min    | Ninguno |
| 0.4 | **SEC-15**: Forzar `status='PENDING'` en VacationController.create                        | 10 min   | Bajo    |
| 0.5 | **HYGIENE-01**: Borrar `scripts/seed-admin-inline.js`                                     | 1 min    | Ninguno |
| 0.6 | **SEC-05**: Quitar `VITE_KIOSK_DEVICE_SECRET` del frontend                                | 15 min   | Medio   |
| 0.7 | **LOW-04**: Fix `delete` catch en ObraExpenseController para respetar AppError.statusCode | 5 min    | Ninguno |

### Sprint 1 — Seguridad crítica (1-2 días)

| #   | Tarea                                                                                        | Esfuerzo |
| --- | -------------------------------------------------------------------------------------------- | -------- |
| 1.1 | **SEC-01**: Fix path traversal en DocumentSignService                                        | 30 min   |
| 1.2 | **SEC-02**: Añadir autorización a DocumentTemplateController.sign                            | 1h       |
| 1.3 | **SEC-03**: Migrar calendar feed a `CALENDAR_FEED_SECRET` dedicado                           | 2h       |
| 1.4 | **SEC-04**: Separar PIN de kiosk del password de login                                       | 3h       |
| 1.5 | **SEC-06 a SEC-19**: Fix cross-tenant IDOR en todos los controllers (patrón `isGlobalAdmin`) | 1 día    |
| 1.6 | **MIGR-01**: Eliminar `database/migrations/` legacy                                          | 15 min   |
| 1.7 | **MIGR-02**: Crear migración Prisma para `imageUrl` + `recurrence` (solo archivo)            | 30 min   |

### Sprint 2 — Integridad de datos y bugs funcionales (2-3 días)

| #    | Tarea                                                          | Esfuerzo |
| ---- | -------------------------------------------------------------- | -------- |
| 2.1  | **DATA-01**: Idempotencia transaccional en import de obras     | 3h       |
| 2.2  | **DATA-02**: Wrap inventory+documento+asset en transacción     | 3h       |
| 2.3  | **DATA-04**: Transacción en createManualPayroll                | 1h       |
| 2.4  | **DATA-05**: Guard transaccional en "borrow from next year"    | 2h       |
| 2.5  | **BUG-02**: Migrar dinero a Decimal/centros enteros end-to-end | 1 día    |
| 2.6  | **BUG-03**: Fix timezone en AnomalyService                     | 2h       |
| 2.7  | **BUG-06**: Fix imports rotos en OnboardingService             | 1h       |
| 2.8  | **BUG-07**: Usar `exitDate` en AnalyticsService                | 30 min   |
| 2.9  | **BUG-09**: Holidays a DB table o year-parameterized           | 2h       |
| 2.10 | **TEST-01**: Fix VacationRequestService quota rejection        | 2h       |

### Sprint 3 — Infraestructura y performance (2-3 días)

| #    | Tarea                                                             | Esfuerzo |
| ---- | ----------------------------------------------------------------- | -------- |
| 3.1  | **DATA-07**: Migrar BackupService a async fs APIs                 | 3h       |
| 3.2  | **DATA-10**: Hacer fail-open configurable en RedisRateLimiter     | 1h       |
| 3.3  | **MID-22**: Fix N+1 en NotificationProducer (bulk fetch admins)   | 2h       |
| 3.4  | **MID-23**: Reemplazar LRU O(n) por Map-based O(1)                | 1h       |
| 3.5  | **MID-24**: Añadir heartbeat + max-clients a NotificationStream   | 2h       |
| 3.6  | **INFRA-01**: Mover migraciones a init container / CI job         | 3h       |
| 3.7  | **INFRA-02**: Quitar red `coolify` external del compose base      | 15 min   |
| 3.8  | **INFRA-03**: Reconciliar `COOKIE_SAMESITE` entre templates       | 30 min   |
| 3.9  | **INFRA-06**: nginx unprivileged en frontend Dockerfile           | 1h       |
| 3.10 | **INFRA-07/08**: Trivy exit-code gate + Buildx cache + image scan | 2h       |

### Sprint 4 — Schema, frontend y deuda técnica (3-4 días)

| #    | Tarea                                                              | Esfuerzo |
| ---- | ------------------------------------------------------------------ | -------- |
| 4.1  | **DB-01**: Añadir `@@index` en FKs faltantes                       | 30 min   |
| 4.2  | **DB-03**: Convertir status/type a enums (User.role prioritario)   | 1 día    |
| 4.3  | **DB-09**: Añadir `@db.Decimal(15,2)` a money columns              | 1h       |
| 4.4  | **INFRA-04**: Eliminar o cifrar `Card.pin`                         | 30 min   |
| 4.5  | **FE-01/05**: Reemplazar `window.confirm()` con `useConfirm()`     | 2h       |
| 4.6  | **FE-02/08**: Añadir AbortController en ObrasPage y CommandPalette | 2h       |
| 4.7  | **FE-03**: Consolidar NotificationBell con NotificationContext     | 1h       |
| 4.8  | **FE-09**: Eliminar `any` pervasive — definir tipos compartidos    | 1 día    |
| 4.9  | **TEST-03**: Hacer suite de tests pasable sin infra (mock Prisma)  | 1 día    |
| 4.10 | **TEST-05**: Tests para PayrollController + AccountingService      | 1 día    |
| 4.11 | **HYGIENE-02**: Limpiar `backend/src/scripts/` debug files         | 1h       |
| 4.12 | **HYGIENE-03**: `git rm --cached` tooling dirs + fix README        | 1h       |

---

## 🏆 Áreas a mantener (referencia positiva)

- **AuditService**: retry con backoff, PII scrubbing antes de Sentry, enums estructurados
- **EncryptionService**: AES-256-GCM correcto, IV aleatorio de 12 bytes, verificación de auth-tag, fallback CBC legacy seguro
- **DocumentLayoutService.loadImageBuffer**: bloqueo SSRF + path-traversal containment (el patrón a copiar)
- **Paginación cursor**: aplicada consistentemente en AlertService, AnalyticsService, NotificationProducer
- **VacationRequestService.updateVacationStatus**: optimistic locking correcto via `updateMany` + status re-check en transacción
- **Auth frontend**: tokens en HttpOnly cookies, CSRF en mutaciones, refresh queue con redirect-storm guard
- **Env validation** (`configValidator.ts`): fail-fast en secrets faltantes/débiles, forbids placeholders en prod
- **Container hardening**: non-root, cap_drop ALL, no-new-privileges, 127.0.0.1 bindings

---

## 📎 Notas metodológicas

- **5 agentes en paralelo** cubrieron: Controllers (55 archivos), Services (~70 archivos), Frontend (~60 archivos), DB/Infra (schema + migrations + Docker + CI + config), Tests/Hygiene (repo entero)
- **No se leyó ningún archivo `.env`** (contienen secrets). Solo `.env.example`
- **No se ejecutó ninguna migración** ni comando que modifique la BD
- Los IDs de hallazgos (SEC-XX, BUG-XX, etc.) permiten referenciarlos en commits, PRs y issues
- Algunos hallazgos LOW están agrupados; consultar reportes individuales de agentes para detalle exhaustivo
