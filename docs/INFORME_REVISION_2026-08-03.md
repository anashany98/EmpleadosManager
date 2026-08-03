# Informe de revisión — EmpleadosManager

**Fecha:** 2026-08-03 · **Revisor:** Mavis · **Commit:** `2ed1fe0` (corrige guardado de notas diarias)

## Alcance y metodología

Revisión estática de backend (`backend/src`, 418 archivos), frontend (`frontend/src`, 261 archivos),
schema Prisma y migraciones, Docker/nginx/CI, más verificación dinámica:

| Chequeo                         | Resultado                         |
| ------------------------------- | --------------------------------- |
| `tsc` backend                   | ✅ compila sin errores            |
| `vite build` frontend           | ✅ OK en 7,6 s (2 chunks >500 kB) |
| Tests backend (vitest)          | ✅ 897/897 en 112 archivos        |
| Tests frontend (vitest)         | ✅ 139/139 en 26 archivos         |
| ESLint backend                  | 0 errores, **1135 warnings**      |
| `npm audit --omit=dev` backend  | 3 moderadas                       |
| `npm audit --omit=dev` frontend | **2 altas** (react-router)        |

Re-ejecutado tras la remediación (mismo día): `tsc` backend ✅ · 897/897 tests backend ✅ ·
139/139 tests frontend ✅ · `vite build` ✅ · `npm audit --omit=dev` backend → **0 vulnerabilidades**.

**Resumen ejecutivo:** el proyecto está en muy buen estado. Las defensas clave (auth, CSRF,
tenant-scoping, uploads, cifrado, rate limiting) están bien implementadas y los hallazgos
críticos de auditorías previas (CRIT-001, SEC-01/02, HIGH-003, HIGH-004, HIGH-011…) aparecen
corregidos en el código actual. Aun así, esta revisión encuentra **2 altos, 6 medios y 8 bajos**
nuevos o aún vigentes, detallados abajo. Estado de remediación al final del documento
(sección "Remediación aplicada el 2026-08-03").

---

## 🔴 Hallazgos ALTOS

### ALT-1 · Spoofing de `X-Forwarded-For` anula el rate-limit de PIN del kiosk (y falsifica IPs de auditoría)

**Archivos:** `backend/src/controllers/KioskController.ts:14-20`, `backend/src/controllers/ConsentController.ts:8-12`

```ts
function getRequesterIp(req: Request): string | undefined {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string') return forwardedFor.split(',')[0].trim(); // ← izquierda = controlable por el cliente
  return req.ip;
}
```

nginx añade el IP real a la derecha (`$proxy_add_x_forwarded_for`, `nginx/templates/default.conf.template:95,113,132…`),
así que la entrada **más a la izquierda** del header la puede inventar el cliente. Consecuencias:

- El límite de PIN del kiosk (`PIN_ATTEMPT_LIMIT = 5` por empleado+IP cada 15 min,
  `KioskController.ts:10-11`) se evade enviando un `X-Forwarded-For` distinto en cada intento:
  fuerza bruta de PIN ilimitada contra cualquier `employeeId`.
- Los consentimientos GDPR quedan auditados con IP falsificable (`ConsentController.ts`),
  debilitando el valor probatorio del registro.

La app ya configura `trust proxy = 1` (`createApp.ts:59`), por lo que `req.ip` ya devuelve el
cliente correcto. **Fix (1 línea):** usar `req.ip` en ambos helpers y borrar la lectura del header crudo.

> ✅ **Corregido (2026-08-03):** `getRequesterIp` usa `req.ip` en ambos controladores. Además el
> módulo kiosk completo queda **apagado por defecto** (kill-switch en `kioskRoutes.ts`): todos sus
> endpoints devuelven `503` salvo que se defina `KIOSK_ENABLED=true` en el entorno.

### ALT-2 · Datos personales reales (nóminas/gestoría) commiteados en git

**Archivos:** `documentos-referencia/gestoria.xlsx` (618 KB), `documentos-referencia/2026 CONTROL (1).xlsx`, `documentos-referencia/horario.xlsx`

Verificado el contenido: `gestoria.xlsx` es un documento real de **DECORACIONES EGEA SL**
(julio 2026) con nombre y apellidos de empleados reales (`CIOACA, VASILE`, `EGEA JIMENEZ, CARLOS`…)
y columnas de conceptos salariales (atrasos, comisiones, horas extra, dietas). Está en el
historial git desde `2dafb7f` / `70cb92f`.

Aunque el repo sea privado, es PII de categoría especial (datos salariales) en un VCS:
cualquier clon, fork, export o futuro cambio de visibilidad lo fuga. Choca además con el
esfuerzo GDPR del proyecto (cifrado at-rest, soft-delete, purge scheduler).

**Fix:** borrar los archivos del working tree y purgar el historial con `git filter-repo`;
conservarlos fuera del repo (o en un bucket con acceso restringido). Rotar/verificar después
quién tiene clones.

> ⏸️ **Sin cambios (decisión del usuario, 2026-08-03):** `documentos-referencia/gestoria.xlsx`
> se deja tal cual por ahora. El riesgo sigue vigente; retomar cuando se decida.

---

## 🟠 Hallazgos MEDIOS

### MED-1 · `generate-access` sin scope de empresa → fuga de email cross-tenant

**Archivos:** `backend/src/routes/authRoutes.ts:75`, `backend/src/controllers/PasswordController.ts:222-277`

La ruta solo exige `restrictTo('admin')` — y en este sistema existen admins **por empresa**
(`requireGlobalAdmin` distingue admin global de admin de empresa, `authMiddleware.ts:129-141`).
El controlador busca `prisma.employee.findUnique({ where: { id: employeeId } })` sin filtro de
empresa y responde `{ email, hasEmail: true }`. Un admin de la empresa A puede:

1. Confirmar si un `employeeId` de la empresa B existe (enumeración).
2. Obtener su email en la respuesta.
3. Dispararle emails de activación no solicitados.

**Fix:** validar `assertCompanyAccess(user, employee.companyId)` tras el `findUnique`
(o usar `requireEmployeeCompanyAccess` corregido — ver BAJ-1).

> ✅ **Corregido (2026-08-03):** `PasswordController.ts:241` — `assertCompanyAccess(requester,
employee.companyId, …)` tras la búsqueda del empleado (helper estricto ya existente).

### MED-2 · Actividad del kiosk sin filtro de empresa

**Archivo:** `backend/src/controllers/KioskController.ts:191-209`

`getKioskActivity` (ruta `GET /api/kiosk/activity`, `restrictTo('admin','hr')`, `kioskRoutes.ts:14`)
devuelve los 10 últimos fichajes de **todas** las empresas (nombre de empleado + timestamp).
**Fix:** filtrar por `getCompanyFilter` / `resolveAuthorizedCompanyId` y join de `employee.companyId`.

> ✅ **Corregido (2026-08-03):** `getKioskActivity` resuelve la empresa autorizada con
> `resolveAuthorizedCompanyId` y filtra `employee.companyId`. Además, con el kiosk apagado por
> defecto (ver ALT-1), la ruta solo responde si se reactiva explícitamente.

### MED-3 · PII en columnas de texto plano junto a las cifradas

**Archivo:** `database/prisma/schema.prisma:113-152`

`Employee.dni` (`@unique`), `iban`, `socialSecurityNumber` y los salarios `Decimal` conviven con
sus versiones `*Enc` (AES-256-GCM). El schema documenta que las columnas planas se conservan
para queries ad-hoc y para la constraint de unicidad, y de hecho hay código que consulta por la
columna plana (`PasswordController.ts:99` busca por `dni` plano). El riesgo no es teórico: si
cualquier path de escritura rellena la columna plana y la cifrada, el cifrado at-rest queda
anulado en la práctica y un dump/backup contiene la PII legible.

**Recomendación:** (a) auditar con un grep que ningún `create/update` escriba ya `dni/iban/nss`
planos; (b) vaciar las columnas planas (`UPDATE ... SET dni = NULL`) manteniendo solo `dniEnc`;
(c) si la unicidad es imprescindible, valorar una columna de hash determinista (HMAC del DNI
con clave de servidor) en lugar del plano.

> 🔎 **Auditado y cerrado (2026-08-03) — sin borrado de datos:**
>
> - **IBAN / NSS:** ningún path de escritura de producción los guarda en plano. Creación
>   (`EmployeeWriteService.ts:151-154`), actualización (`:250-262`) e importación masiva
>   (`EmployeeImportService.ts:299-300`) escriben siempre el cifrado AES-256-GCM. Los salarios
>   van cifrados vía `SalaryEncryption` con la columna `Decimal` legacy a cero.
> - **Query de verificación read-only** (`scripts/audit-pii-columns.sql`, solo conteos, sin
>   valores): en la BD local hay **0 IBAN y 0 NSS almacenados**, por lo que no existe exposición
>   en plano de esos campos.
> - **DNI en plano = decisión de diseño explícita**, documentada en
>   `EmployeeWriteService.ts:131-133`: se necesita buscable/único para login del kiosk e
>   imports (`findUnique({ where: { dni } })`). Existe mirror cifrado `dniEnc` para una futura
>   migración a cifrado total; esa migración requeriría sustituir las lookups por un HMAC
>   determinista y queda como trabajo futuro.
> - **Gap menor detectado (→ BAJ-8):** el importador masivo cifra en las columnas legacy pero no
>   rellena las columnas `*Enc` nuevas.
> - **Opcional ejecutado (2026-08-03):** el script existente `scripts/backfill-pii-encryption.ts`
>   (trackeado, idempotente, solo rellena NULLs) se ejecutó contra la BD local. Antes:
>   `dni_enc_poblado = 2/11` (ibanPosiblePlano=0, ssnPosiblePlano=0). Después: `dni_enc_poblado = 11/11`.
>   Segunda ejecución idempotente sin cambios. Se localizó y arregló un bug en el propio script
>   que no afectaba a la BD local pero lo habría roto en cualquier entorno: Prisma 5
>   rechaza `{ dni: { not: null } }` sobre `Employee.dni` (campo requerido, `StringFilter.not`
>   no acepta `null`). Sustituido por `{ dni: { not: '' } }`.

### MED-4 · Drift: la BD local de desarrollo está por detrás del schema

La migración `20260727133000_payroll_control_hardening` añade `Employee.payrollAgencyEmployeeCode`,
pero la BD local no la tiene: los tests de integración levantan `P2022`
("The column `Employee.payrollAgencyEmployeeCode` does not exist in the current database")
contra `PasswordController.ts:96`. Es el mismo HIGH-005 de la auditoría previa, reproducido hoy.

**Fix:** `npm run db:migrate` (o `infra:up` + migrate) y documentar el paso en el README de dev.

> ✅ **Corregido (2026-08-03):** la causa raíz era que `20260625000001_add_absence_type_config`
> constaba como aplicada pero la tabla `AbsenceTypeConfig` no existía en la BD local. Se aplicó
> manualmente el SQL de esa migración (no destructivo, idéntico al archivo de migración), se
> marcó `rolled-back` la seed que dependía de ella y se ejecutó `prisma migrate deploy`
> (no interactivo). Estado final: **51 migraciones, "Database schema is up to date"**.

### MED-5 · Strings corruptos (mojibake) visibles para el usuario

Doble encoding UTF-8 (lectura como cp1252 + reescritura) en mensajes de la app:

| Archivo                                        | Ocurrencias | Ejemplo                                                  |
| ---------------------------------------------- | ----------- | -------------------------------------------------------- |
| `backend/src/controllers/PayrollController.ts` | 21          | L360: `"El lote de nÃ³minas manuales… ya estÃ¡ cerrado"` |
| `backend/src/services/ObjectiveService.ts`     | 1           | —                                                        |
| `frontend/src/pages/AuditLogPage.tsx`          | 2           | —                                                        |

**Fix:** reemplazar `Ã³→ó`, `Ã¡→á`, `â€"→—`, etc. (reversión idempotente; cuidado con editarlos
otra vez con un editor que no respete UTF-8).

> ✅ **Corregido (2026-08-03):** 24 strings restaurados a UTF-8 correcto en los tres archivos
> (21 en `PayrollController.ts`, 1 en `ObjectiveService.ts`, 2 en `AuditLogPage.tsx`).

### MED-6 · Dependencias con advisories

**Frontend (2 altas):** `react-router-dom 7.18.1` → `react-router ≥7.12.0 <8.3.0`:
GHSA-qwww-vcr4-c8h2 (CSRF bypass en modo RSC) + advisory relacionado. **Matiz importante:**
ambos afectan solo a las APIs _unstable RSC_, que esta SPA no usa → riesgo real bajo, pero el
`npm audit` lo marca alto y la fix pasa por `react-router 8.x` (major) o pin a `<7.12.0`.
`npm audit fix --force` propone **downgrade** a 7.11.0: no hacerlo a ciegas (rompe semver del lockfile).

**Backend (3 moderadas):** `@opentelemetry/*` vía `@sentry/node` — `npm audit fix` resuelve.

**Fix recomendado:** `npm audit fix` en backend ya; en frontend, decidir entre pin
`react-router-dom ~7.11.0` (si no se usa nada de 7.12+) o planear el salto a 8.x.

> ✅ **Backend corregido (2026-08-03):** `npm audit fix --omit=dev` → **0 vulnerabilidades** en
> dependencias de producción (las dev se reinstalaron después y el tooling sigue funcionando).
>
> ⚠️ **Frontend — riesgo aceptado:** el downgrade a `react-router-dom@7.11.0` propuesto por
> `audit fix` se probó y **empeoraba** el resultado (14 advisories altas del rango
> `react-router 6.0.0–7.17.0`), así que se mantiene `7.18.1` (última 7.x). Los 2 avisos altos
> restantes afectan solo a las APIs _unstable_ de modo RSC/framework que esta SPA no usa. La
> solución limpia es el salto a `react-router 8.x` (major) — planificar como tarea aparte.
>
> ✅ **Migración a `react-router 8.x` (2026-08-03):** se ha sustituido `react-router-dom@7.18.1`
> por `react-router@^8.2.0` (paquete canónico de v8; en v8 el paquete `react-router-dom` ya
> no se publica y la SPA usa `BrowserRouter` declarativo, no `RouterProvider`, así que basta
> con cambiar el specifier de los 47 archivos de `src/` de `react-router-dom` a
> `react-router`). `vite.config.ts:manualChunks` actualizado para apuntar a
> `node_modules/react-router/`. React 19.2.8 ≥ 19.2.7 (req. v8), Node 24 ≥ 22.22 (req. v8),
> `tsconfig.app.json` ya era `target: ES2022`. Suite `139/139` y `vite build` OK.
>
> **El advisory GHSA-qwww-vcr4-c8h2 sigue presente** (1 aviso alto, no 2) porque la versión
> parcheada (`8.3.0`) **no está publicada en npm todavía** (verificado hoy, `npm view
react-router@8.3.0` → 404; latest = 8.2.0). Cuando se publique, la corrección será un
> `npm install react-router@^8.3.0` sin más (la major migration ya está hecha). Real risk
> sigue siendo bajo: la SPA no usa el modo RSC ni `unstable_*` APIs.

---

## 🟡 Hallazgos BAJOS / higiene

### BAJ-1 · Helpers de autorización muertos que fallan ABIERTO

`backend/src/utils/companyAccess.ts:75-124`: `getCompanyFilter()` y `requireEmployeeCompanyAccess()`
devuelven "sin filtro" / dejan pasar cuando `user.companyId` es `undefined` y el usuario no es
global admin (p. ej. un usuario `hr` sin ficha de empleado). Hoy **nadie los usa** (los paths
críticos usan la variante estricta `resolveAuthorizedCompanyId`), pero son una trampa latente:
quien los importe creyendo que son equivalentes introduce un bypass tenant.
**Fix:** hacerlos fail-closed (`throw AppError 403` si no hay empresa) o eliminarlos.

### BAJ-2 · El PIN del kiosk ES la contraseña del usuario (y los endpoints siguen vivos)

> ✅ **Mitigado (2026-08-03):** los endpoints ya NO siguen vivos por defecto — el kill-switch de
> `kioskRoutes.ts` devuelve 503 salvo `KIOSK_ENABLED=true`. El aviso sobre PIN=contraseña aplica
> solo si se reactiva el módulo.

`KioskController.ts:138` compara el "PIN" contra `user.password`. La UI del kiosk está
desactivada (decisión 2026-07-20, `frontend/src/App.tsx:11-15`), pero `POST /api/kiosk/auth` y
`/api/kiosk/clock` siguen activos y exentos de CSRF (`csrfMiddleware.ts:28`). Si el kiosk se
reactiva, teclear la contraseña completa en una tablet compartida es un riesgo (shoulder
surfing, keyloggers de pantalla). **Fix si se reactiva:** campo `pinHash` separado con política
propia, o deshabilitar los endpoints mientras no se usen.

### BAJ-3 · Comparación de token CSRF no constant-time

`backend/src/middlewares/csrfMiddleware.ts:46` usa `!==` entre cookie y header. Para un
double-submit token el impacto es bajo, pero `crypto.timingSafeEqual` es gratis y ya se usa en
el proyecto (`KioskController.ts:102`).

### BAJ-4 · `GdprPurgeScheduler` usa `exec` con shell y sin validar el número

`backend/src/services/GdprPurgeScheduler.ts:47-51`: `exec(\`bash "${scriptPath}" --retention-years ${retentionYears}\`)`.
No hay input de usuario, pero `parseInt`de un env inválido produce`NaN`(el script recibiría`--retention-years NaN`) y `execFile`evitaría el shell. **Fix:**`execFile('bash', [scriptPath, '--no-dry-run', '--retention-years', String(n)])`validando`Number.isInteger`.

### BAJ-5 · Basura en el repo

- `nul` (raíz y `backend/nul`) — artefactos de redirecciones `> nul` de Windows.
- `dummy.pdf`, `01-login*.png`, `02-dashboard.png`, `mobile-login-test.png`, `flows.html/json`,
  `frontend/build_output.txt`, `frontend/file_list.txt` en el árbol.
- Carpeta `Beamng/` en la raíz del workspace (sin relación con el proyecto).
- Sin trackear pero presentes: `scripts/create_test_user.sql`, `scripts/bust-cache.cjs`,
  `AUDITORIA_COMPLETA.md`, `SOLUCIONES_Y_MEJORAS.md`.

**Fix:** mover a `tmp/` o borrar (papelera), ampliar `.gitignore`.

### BAJ-6 · Chunks de frontend >500 kB

`vendor-pdf` (572 kB / 168 kB gzip) y `vendor-misc` (647 kB / 217 kB gzip). El build avisa.
**Fix:** `manualChunks` para jspdf/pdf-lib y lazy-load donde se usen.

### BAJ-7 · Validación de contraseña inconsistente frontend/backend

El frontend acepta passwords desde 6 caracteres (`frontend/src/lib/validation.ts:12,19,31`)
mientras el backend exige 10 + mayúsculas + números + símbolos
(`backend/src/utils/passwordPolicy.ts`). El backend siempre gana, pero el usuario recibe un
error tarde y confuso. **Fix:** espejar la política en el schema zod del frontend.

### BAJ-8 · El importador masivo no rellena las columnas `*Enc` (detectado en la auditoría MED-3)

`EmployeeImportService.ts:299-300` escribe el IBAN y el NSS cifrados en las columnas legacy
(`socialSecurityNumber`, `iban`) pero no pobla `socialSecurityNumberEnc` / `ibanEnc` (y tampoco
`dniEnc`), a diferencia de `EmployeeWriteService` que escribe ambas. Los empleados importados
quedan con los campos `*Enc` a NULL. No fuga nada en plano (la columna legacy lleva ciphertext
y la read-path la descifra), pero deja un hueco en el modelo "columnas `*Enc` como fuente
autoritativa futura" y puede producir comportamiento inconsistente entre empleados creados a
mano vs. importados. **Fix:** duplicar el ciphertext en las columnas `*Enc` dentro del
`employeeData` del importador (2 líneas), mismo patrón que `EmployeeWriteService.ts:150-154`.

> ✅ **Corregido (2026-08-03):** `EmployeeImportService.ts` ahora calcula el ciphertext una sola
> vez y lo escribe en la columna legacy y en la `*Enc` (mismo valor en ambas, idéntico a
> `EmployeeWriteService`): `socialSecurityNumber`/`socialSecurityNumberEnc`, `iban`/`ibanEnc` y
> además `dniEnc` (el DNI es obligatorio en cada fila importada). Aplica a create y a update
> (re-importación de un DNI existente). Tests nuevos en `EmployeeImportService.test.ts` cubren
> ambos paths: 7/7 pasando.

---

## ⏳ Pendientes heredados de auditorías previas (verificados hoy)

| Ref previa                                   | Estado                                                                                                                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HIGH-009 · Decimal→float en nóminas          | **Sigue:** `PayrollController.ts:280,376-377` usa `parseFloat` para importes de nómina. Para validación es tolerable, pero el almacenamiento/cálculo monetario debería usar `Decimal` del schema, no floats. |
| LOW-001 · Deuda de lint                      | **Sigue:** 1135 warnings backend (0 errores). `lint:strict --max-warnings 1100` falla.                                                                                                                       |
| HIGH-005 · Drift de schema                   | **Sigue:** ver MED-4.                                                                                                                                                                                        |
| HIGH-004 · PIN=contraseña / secret en bundle | Parcial: UI desactivada (bundle limpio), API activa → BAJ-2.                                                                                                                                                 |
| MED-007 · Mensajes internos en 500           | Corregido en los paths revisados (`errorMiddleware.ts:29-33`, `fileDownload.ts:200-204`).                                                                                                                    |

---

## ✅ Verificado en buen estado (sin hallazgos)

- **Auth:** JWT HS256 con algoritmo fijado, `sessionVersion` obligatoria en token y WebSocket
  (`websocket/handler.ts:109-120`), refresh tokens hasheados + rotación + detección de reuso
  con revocación total (`AuthController.ts:118-141`), lockout de cuenta, access token de 15 min.
- **CSRF/CORS/Helmet:** double-submit con cookie SameSite strict en prod, CORS fail-closed en
  producción, CSP completa, HSTS.
- **Uploads/descargas:** memoryStorage 5 MB + validación por magic bytes
  (`config/multer.ts:116-195`), contención de path con `startsWith(dir + sep)` en descargas
  (`utils/fileDownload.ts:93-127`), Content-Disposition sanitizado (RFC 6266/5987).
- **Cifrado:** AES-256-GCM con IV aleatorio, auth tag, validación fail-fast al arranque
  (`EncryptionService.ts`); `SMTP_PASS` cifrado en BD (`SmtpController.ts:53-61`).
- **Multi-tenancy (muestra):** `resolveAuthorizedCompanyId` es estricto en reportes, insights,
  gestoría y empresas; gestión de usuarios solo `requireGlobalAdmin`; backups/SMTP solo admin global.
- **Secretos:** ningún `.env` trackeado, claves SSL gitignoreadas, seeds sin contraseñas
  fallback, CI usa GitHub Secrets.
- **Docker:** `cap_drop: ALL`, `no-new-privileges`, puertos internos en `127.0.0.1`, envs
  obligatorias con fail-fast, backups diarios + offsite OneDrive con healthcheck de staleness.

---

## Prioridades sugeridas

1. **ALT-1** — fix de 1 línea (`req.ip` en vez de header crudo).
2. **MED-1 / MED-2** — añadir scope de empresa (patrones ya existen en el repo).
3. **ALT-2** — purgar los Excel reales del historial git.
4. **MED-4** — `npm run db:migrate` en local.
5. **MED-6** — `npm audit fix` backend; decidir versión de react-router.
6. Resto (MED-5, BAJ-\*) cuando haya hueco; BAJ-1 conviene resolverlo antes de que alguien reuse esos helpers.

---

## 🔧 Remediación aplicada el 2026-08-03

| Hallazgo            | Estado                             | Detalle                                                                                                                                                                                                                                                                                                                               |
| ------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kiosk**           | 🛑 Desactivado                     | Kill-switch en `backend/src/routes/kioskRoutes.ts`: todos los endpoints devuelven 503 salvo `KIOSK_ENABLED=true` en el entorno.                                                                                                                                                                                                       |
| **ALT-1**           | ✅ Corregido                       | `getRequesterIp` usa `req.ip` en `KioskController.ts` y `ConsentController.ts`; eliminada la lectura cruda de `X-Forwarded-For`.                                                                                                                                                                                                      |
| **ALT-2**           | ⏸️ Intencionadamente pendiente     | `documentos-referencia/gestoria.xlsx` sin tocar, por decisión del usuario.                                                                                                                                                                                                                                                            |
| **MED-1**           | ✅ Corregido                       | `assertCompanyAccess` en `PasswordController.generateAccess` (`PasswordController.ts:241`).                                                                                                                                                                                                                                           |
| **MED-2**           | ✅ Corregido                       | `getKioskActivity` filtra por `resolveAuthorizedCompanyId` + `employee.companyId`.                                                                                                                                                                                                                                                    |
| **MED-3**           | 🔎 Auditado y cerrado              | Ningún path de producción escribe IBAN/NSS/salarios en plano (ver detalle en el hallazgo). DNI plano es diseño explícito con mirror `dniEnc`. Sin borrado de datos. Añadido `scripts/audit-pii-columns.sql` (read-only) para re-verificar. Gap menor → BAJ-8.                                                                         |
| **MED-4**           | ✅ Corregido                       | Migraciones aplicadas; `prisma migrate status` → up to date (51 migraciones).                                                                                                                                                                                                                                                         |
| **MED-5**           | ✅ Corregido                       | 24 strings mojibake restaurados.                                                                                                                                                                                                                                                                                                      |
| **MED-6**           | ✅ Backend / ✅ Frontend (parcial) | Backend: 0 vulnerabilidades en prod. Frontend: migrado a `react-router@^8.2.0` (paquete canónico de v8). El aviso GHSA-qwww-vcr4-c8h2 sigue presente (1, no 2) hasta que npm publique la versión parcheada `8.3.0` (verificado hoy: no publicada). Real risk bajo: la SPA no usa RSC ni `unstable_*`.                                 |
| **BAJ-8**           | ✅ Corregido                       | Importador masivo (`EmployeeImportService.ts`) ahora escribe `socialSecurityNumber`, `iban` y `dni` cifrados en las columnas `*Enc` correspondientes con el mismo ciphertext que las columnas legacy (mismo patrón que `EmployeeWriteService`). Cubre create y update. 2 tests nuevos en `EmployeeImportService.test.ts` (7/7 verde). |
| **Backfill dniEnc** | ✅ Ejecutado                       | `scripts/backfill-pii-encryption.ts` (ya existente, idempotente) ejecutado en BD local: `dni_enc_poblado` 2/11 → 11/11. IBAN/NSS = 0 (sin cambios). Bug encontrado y arreglado en el propio script: `{ dni: { not: null } }` no es válido en Prisma 5 sobre `Employee.dni` (campo requerido → `StringFilter.not` no acepta `null`).   |
| **BAJ-2**           | ✅ Mitigado                        | Kiosk apagado por defecto (ver arriba).                                                                                                                                                                                                                                                                                               |

**Verificación posterior a los cambios:** `tsc` backend ✅ · 900/900 tests backend ✅
(897 originales + 2 tests BAJ-8 + 1 alto en HIGH-008 desdoblado en 2) · 139/139 tests
frontend ✅ · `vite build` frontend ✅ (exit 0) · `npm audit --omit=dev` backend 0
vulnerabilidades · `npm audit --omit=dev` frontend 1 aviso alto (GHSA-qwww-vcr4-c8h2,
pendiente de `react-router@8.3.0` upstream).

**Cambios NO realizados (por restricción de no tocar datos / no asumir riesgo):**

- Ningún borrado ni UPDATE de datos en la BD (la intervención en migraciones fue solo DDL
  faltante + registros de `_prisma_migrations`, y el backfill de `dniEnc` es aditivo,
  solo rellena NULLs).
- Purga del historial git (ALT-2).
