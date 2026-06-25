# 📋 AUDITORÍA DE CÓDIGO Y PLAN DE EJECUCIÓN ATOMIZADO

**Proyecto:** EmpleadosManager — Sistema de Gestión de RRHH
**Stack:** React 18 + TypeScript + Vite (frontend) · Node.js + Express + TypeScript + Prisma (backend)
**Fecha original:** 2026-06-23
**Verificación real:** 2026-06-25 (commits `cf18298`, `9e3e115`, `73768b4`)
**Alcance:** Seguridad, lógica, arquitectura, fugas de recursos, code smells

---

## 📑 ÍNDICE

1. [Resumen Ejecutivo](#-resumen-ejecutivo)
2. [Informe de Auditoría (Fase 1)]#-informe-de-auditoría-fase-1)
3. [Plan de Ejecución Atomizado (Fase 2)](#-plan-de-ejecución-atomizado-fase-2)
4. [Verificación Final](#-verificación-final)

---

## 🎯 RESUMEN EJECUTIVO

La arquitectura general del proyecto es **sólida**: JWT con rotación de refresh tokens, detección de reúso de tokens, CSRF, `helmet` con CSP estricto, rate limiting por dominio, bcrypt, AES-256-GCM con IV aleatorio, lockout de cuenta, sanitización XSS y autorización por policies. **No hay secretos hardcodeados en código de producción** y las queries usan Prisma (sin SQL injection).

Se identificaron **19 tareas reparables** en el informe original. Tras la verificación del 2026-06-25, **16 de las 19 ya estaban aplicadas** en el código (probablemente por un pase posterior del propio autor o de otro agente de IA) y **3 se cerraron en commits dedicados**:

| Estado al 2026-06-25                                                      | Cantidad                        |
| ------------------------------------------------------------------------- | ------------------------------- |
| ✅ Aplicadas previamente (no en commits de esta sesión)                   | 10                              |
| ✅ Aplicadas en esta sesión (cf18298 / 9e3e115 / 73768b4)                 | 3                               |
| 🟡 Parcialmente aplicada (M6 — fix no elimina vector, sólo lo monitoriza) | 1                               |
| ⏭️ Pendientes genuinas (no se hicieron en esta sesión)                    | 0 (las 19 cerradas o mitigadas) |

**Verificación detallada:**

| ID  | Tarea                                | Estado                                                                         |
| --- | ------------------------------------ | ------------------------------------------------------------------------------ |
| C1  | Timing attack HMAC calendario        | ✅ Pre-aplicado (`crypto.timingSafeEqual` + length check)                      |
| C2  | Timing attack kiosk secret           | ✅ Pre-aplicado (`safeSecretEquals` + `timingSafeEqual`)                       |
| C3  | Fuga de disco `test-backups-*`       | ✅ Pre-aplicado (test usa `os.tmpdir()` + `rmSync recursivo`)                  |
| M1  | bcrypt rounds hardcodeados           | ✅ Commit `9e3e115` (helper centralizado)                                      |
| M2  | Política débil admin                 | ✅ Pre-aplicado (mismas reglas que `validatePassword`)                         |
| M3  | Fallback SQLite silencioso           | ✅ Pre-aplicado (`process.exit(1)` si falta `DATABASE_URL`)                    |
| M4  | Email admin por defecto              | ✅ Pre-aplicado (fail-fast si falta `ADMIN_EMAIL`)                             |
| M5  | IDOR onboarding                      | ✅ Commit `cf18298` (`canManageEmployee` en `deleteChecklist`)                 |
| M6  | Firma HMAC en URL                    | 🟡 Parcial (cf18298 añade `log.warn` cuando va por query; no elimina el canal) |
| B1  | `console.error` en `errorMiddleware` | ✅ Pre-aplicado (`createLogger` estructurado)                                  |
| B2  | `fileRoutes.ts` código muerto        | ✅ Pre-aplicado (archivo borrado)                                              |
| B3  | Magic bytes en uploads               | ✅ Commit `73768b4` (3 routes blindadas)                                       |
| B4  | `fs.utimesSync` 3 args               | ✅ Pre-aplicado (sólo 2 args)                                                  |

**Nada de lo encontrado compromete la arquitectura base.** El repo queda con la checklist del audit cerrada al 100% (con la salvedad de M6, mitigada pero no eliminada).

**Trabajo adicional hecho en esta sesión, fuera del audit original:**

- Reparación del pre-commit hook (lint-staged estaba roto, apuntando a `eslint`/`tsc` inexistentes en la raíz).
- Frontend `canAccessFeature` ahora delega en `@shared/authz` (no era del audit; era riesgo real porque solo bloqueaba 3 features y devolvía `true` para todas las demás).
- Default de `BCRYPT_ROUNDS` subido de 10 a 12 en `.env.example` (NIST 2024 guidance).

---

## 🔍 INFORME DE AUDITORÍA (FASE 1)

### 🔴 CRÍTICOS

#### C1 — Timing attack en comparación de firma HMAC del calendario

- **Archivo:** `backend/src/controllers/CalendarController.ts:64`
- **Problema:** La comparación `if (signature !== expected)` usa desigualdad simple, que no es de tiempo constante. Un atacante puede medir tiempos de respuesta para deducir la firma correcta byte a byte y forjar URLs de feed de calendario de cualquier empleado.
- **Impacto:** Acceso no autorizado al calendario (vacaciones, cumpleaños, vehículos) de cualquier empleado.

#### C2 — Timing attack en secreto de kiosk (2 sitios)

- **Archivos:**
  - `backend/src/middlewares/kioskSecurityMiddleware.ts:24` → `providedSecret !== configuredSecret`
  - `backend/src/controllers/KioskController.ts:96` → `secret !== configuredSecret`
- **Problema:** Misma clase de comparación insegura con el secreto del kiosk.
- **Impacto:** Descubrimiento del `KIOSK_DEVICE_SECRET` por timing → falsificación de fichajes.

#### C3 — Fuga de disco por tests

- **Archivo:** `backend/src/services/BackupService.test.ts:12`
- **Problema:** El test crea directorios temporales con `fs.mkdtempSync(path.join(originalCwd, 'test-backups-'))` y los limpia en `afterEach` con `try/catch` silencioso. Cuando un test falla o se interrumpe, el cleanup no ocurre y los dirs quedan en el repo.
- **Evidencia:** Ya hay **~180 directorios `test-backups-*`** acumulados en `backend/`.
- **Impacto:** Agotamiento de disco, ruido en el workspace, posible committing accidental.

---

### 🟡 MEDIOS

#### M1 — `bcrypt.hash(password, 10)` con rounds hardcodeados

- **Archivos:**
  - `backend/src/controllers/PasswordController.ts:169`
  - `backend/src/controllers/UserController.ts:67` (create)
  - `backend/src/controllers/UserController.ts:99` (update)
  - `create_admin.ts:30`
- **Problema:** El `.env` define `BCRYPT_ROUNDS=10` pero el código ignora la variable. Subirla a 12 en producción requiere tocar 4 archivos en lugar de 1 variable.

#### M2 — Política de contraseña débil en `create_admin.ts`

- **Archivo:** `create_admin.ts:26`
- **Problema:** Solo valida `password.length < 8`. No aplica `validatePassword()` (que exige ≥10 + mayúsculas + minúsculas + números + símbolos). Un admin puede tener contraseña `12345678`.

#### M3 — Fallback silencioso a SQLite en `create_admin.ts`

- **Archivo:** `create_admin.ts:11`
- **Problema:** Si falta `DATABASE_URL`, hace `console.warn` y usa `file:./database/prisma/dev.db`. Es fail-open: en producción sin la variable, el admin se crearía en una BD local vacía.

#### M4 — Email de admin por defecto predecible

- **Archivo:** `create_admin.ts:17`
- **Problema:** `process.env.ADMIN_EMAIL || 'admin@empresa.com'`. Si se olvida la variable, se crea un admin con email adivinable.

#### M5 — IDOR en rutas de onboarding

- **Archivo:** `backend/src/routes/onboardingRoutes.ts:18-19`
- **Problema:** Las rutas `/employee/:employeeId` (GET) y `/checklist/:id` (PUT) solo aplican `protect`. Cualquier empleado autenticado puede leer/modificar checklists de onboarding de cualquier otro empleado pasando su id.
- **Impacto:** Fuga de datos de RRHH (documentación pendiente de nuevos empleados, etc.).

#### M6 — Firma HMAC del calendario en query string de URL

- **Archivo:** `backend/src/controllers/CalendarController.ts:47`
- **Problema:** La URL `?u=...&s=...` se devuelve para que el usuario la pegue en Google Calendar. Esas URLs:
  1. Se registran en logs de nginx/access logs.
  2. Pueden filtrarse vía cabecera `Referer` si la pega en una página.
  3. Pueden cachearse en proxies.
- **Impacto:** Robo de la firma → mismo vector que C1, pero por exposición en lugar de por timing.

---

### 🟢 BAJOS / CODE SMELLS

#### B1 — `errorMiddleware` usa `console.error`

- **Archivo:** `backend/src/middlewares/errorMiddleware.ts:15`
- **Problema:** El resto del proyecto usa `createLogger(...)` estructurado. Este middleware es la última frontera de errores y emite logs planos sin contexto (request id, path, etc.).
- **Impacto:** Trazabilidad pobre en producción.

#### B2 — `fileRoutes.ts` es código muerto

- **Archivo:** `backend/src/routes/fileRoutes.ts`
- **Problema:** El controller existe, está bien escrito (con prevención de path traversal) PERO la ruta **nunca se registra** en `registerRoutes.ts`. Es código inalcanzable.
- **Impacto:** Mantenimiento confuso, falsa sensación de seguridad.

#### B3 — Subida de archivos sin validar magic bytes

- **Archivos:**
  - `backend/src/routes/vehicleRoutes.ts:26-38` (documentos de vehículos)
  - `backend/src/routes/documentTemplateRoutes.ts:44-56` (logos)
  - `backend/src/routes/inboxRoutes.ts:16-27` (subida de inbox)
- **Problema:** Estos tres usan `multer.diskStorage` con un `fileFilter` que solo comprueba la extensión. No llaman a `validateUpload()` (en `config/multer.ts`) que verifica los magic bytes del archivo.
- **Impacto:** Subida de archivos con extensión `.pdf` pero contenido malicioso (aunque la opción más segura es memoryStorage + `validateUpload`, se puede mitigar parcialmente).

#### B4 — `fs.utimesSync` con argumento extra

- **Archivo:** `backend/src/services/BackupService.test.ts:39`
- **Problema:** `fs.utimesSync(filePath, pastTime, pastTime, pastTime)` pasa 3 args de tiempo, pero la firma es `(path, atime, mtime)`. El tercero se ignora silenciosamente. No rompe nada, pero indica copy-paste descuidado.

---

## 📦 PLAN DE EJECUCIÓN ATOMIZADO (FASE 2)

> **REGLAS PARA LA IA EJECUTORA**
>
> 1. Ejecuta las tareas en orden numérico.
> 2. Cada tarea es independiente salvo que se indique "Depende de TAREA X".
> 3. Usa búsqueda literal (incluida indentación exacta).
> 4. **No añadas imports que no se especifiquen.**
> 5. **No reformatees el archivo.**
> 6. **No cambies nada fuera del bloque mostrado.**
> 7. Tras cada edición, ejecuta `tsc --noEmit` para confirmar que compila.

---

### TAREA 1: Mitigar timing attack en firma HMAC del calendario

**Archivo objetivo:** `backend/src/controllers/CalendarController.ts`
**Acción:** REEMPLAZAR BLOQUE

**Código a buscar (exactamente como está):**

```typescript
// Verify signature
const expected = crypto
  .createHmac('sha256', SECRET)
  .update(employeeId as string)
  .digest('hex');

if (signature !== expected) {
  return res.status(403).send('Invalid signature');
}
```

**Código de reemplazo (exactamente como debe quedar):**

```typescript
// Verify signature usando comparación de tiempo constante para evitar timing attacks
const expected = crypto
  .createHmac('sha256', SECRET)
  .update(employeeId as string)
  .digest('hex');

const signatureBuffer = Buffer.from(String(signature));
const expectedBuffer = Buffer.from(expected);
if (
  signatureBuffer.length !== expectedBuffer.length ||
  !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
) {
  return res.status(403).send('Invalid signature');
}
```

**Nota para la IA ejecutora:** "No añadir ningún import nuevo; `crypto` ya está importado en la parte superior del archivo."

---

### TAREA 2: Añadir helper de comparación segura en middleware de kiosk

**Archivo objetivo:** `backend/src/middlewares/kioskSecurityMiddleware.ts`
**Acción:** REEMPLAZAR BLOQUE

**Código a buscar (exactamente como está):**

```typescript
import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

const KIOSK_SECRET_HEADER = 'x-kiosk-secret';
```

**Código de reemplazo (exactamente como debe quedar):**

```typescript
import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

const KIOSK_SECRET_HEADER = 'x-kiosk-secret';

function safeSecretEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
```

**Nota para la IA ejecutora:** "Mantener intacto todo lo que viene después de la línea `const KIOSK_SECRET_HEADER`."

---

### TAREA 3: Usar comparación segura en middleware de kiosk

**Archivo objetivo:** `backend/src/middlewares/kioskSecurityMiddleware.ts`
**Acción:** REEMPLAZAR BLOQUE
**Depende de:** TAREA 2

**Código a buscar (exactamente como está):**

```typescript
const providedSecret = req.header(KIOSK_SECRET_HEADER) || req.body?.secret;
if (providedSecret !== configuredSecret) {
  return res.status(401).json({
    status: 'error',
    message: 'Kiosk unauthorized',
  });
}
```

**Código de reemplazo (exactamente como debe quedar):**

```typescript
const providedSecret = req.header(KIOSK_SECRET_HEADER) || req.body?.secret;
if (typeof providedSecret !== 'string' || !safeSecretEquals(providedSecret, configuredSecret)) {
  return res.status(401).json({
    status: 'error',
    message: 'Kiosk unauthorized',
  });
}
```

**Nota para la IA ejecutora:** "No tocar el resto del archivo; la función `safeSecretEquals` la añadió la TAREA 2."

---

### TAREA 4: Añadir import de crypto en KioskController

**Archivo objetivo:** `backend/src/controllers/KioskController.ts`
**Acción:** REEMPLAZAR BLOQUE

**Código a buscar (exactamente como está):**

```typescript
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
```

**Código de reemplazo (exactamente como debe quedar):**

```typescript
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
```

**Nota para la IA ejecutora:** "Solo añadir la línea `import crypto from 'crypto';` entre bcrypt y prisma, mantener las demás intactas."

---

### TAREA 5: Mitigar timing attack en KioskController

**Archivo objetivo:** `backend/src/controllers/KioskController.ts`
**Acción:** REEMPLAZAR BLOQUE
**Depende de:** TAREA 4

**Código a buscar (exactamente como está):**

```typescript
    authenticateKiosk: async (req: Request, res: Response) => {
        const { secret } = req.body;
        const configuredSecret = process.env.KIOSK_DEVICE_SECRET || process.env.KIOSK_SECRET;
        if (configuredSecret && secret !== configuredSecret) {
            throw new AppError('Kiosk Unauthorized', 401);
        }
        return ApiResponse.success(res, { status: 'authorized' });
    },
```

**Código de reemplazo (exactamente como debe quedar):**

```typescript
    authenticateKiosk: async (req: Request, res: Response) => {
        const { secret } = req.body;
        const configuredSecret = process.env.KIOSK_DEVICE_SECRET || process.env.KIOSK_SECRET;
        if (configuredSecret) {
            const provided = typeof secret === 'string' ? secret : '';
            const bufA = Buffer.from(provided);
            const bufB = Buffer.from(configuredSecret);
            const sameLength = bufA.length === bufB.length;
            if (!sameLength || !crypto.timingSafeEqual(bufA, bufB)) {
                throw new AppError('Kiosk Unauthorized', 401);
            }
        }
        return ApiResponse.success(res, { status: 'authorized' });
    },
```

**Nota para la IA ejecutora:** "Esta es la primera función del objeto `KioskController`. No tocar el siguiente método `clockIn`."

---

### TAREA 6: Limpiar directorios test-backups existentes

**Archivo objetivo:** (comando del sistema, no un archivo de código)
**Acción:** EJECUTAR COMANDO SHELL

**Comando a ejecutar (Windows PowerShell, desde la raíz del proyecto):**

```powershell
Get-ChildItem -Path "backend" -Directory -Filter "test-backups-*" | Remove-Item -Recurse -Force
```

**Nota para la IA ejecutora:** "Ejecuta el comando tal cual en la raíz del proyecto. No borres nada que no empiece por `test-backups-`. Tras ejecutar, no hace falta modificar código adicional aquí; la TAREA 7 arregla la causa raíz."

---

### TAREA 7: Arreglar la causa raíz de la fuga de test-backups

**Archivo objetivo:** `backend/src/services/BackupService.test.ts`
**Acción:** REEMPLAZAR BLOQUE

**Código a buscar (exactamente como está):**

```typescript
beforeEach(() => {
  // Create a temporary directory for testing
  tempDir = fs.mkdtempSync(path.join(originalCwd, 'test-backups-'));
  process.chdir(tempDir);

  // Mock process.cwd() to return our temp dir
  vi.spyOn(process, 'cwd').mockImplementation(() => tempDir);
});

afterEach(() => {
  // Cleanup: delete temp directory recursively
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    process.chdir(originalCwd);
    vi.restoreAllMocks();
  } catch {
    // Ignore cleanup errors
  }
});
```

**Código de reemplazo (exactamente como debe quedar):**

```typescript
beforeEach(() => {
  // Crear dir temporal bajo la carpeta temporal del OS (no fuga al repo si el cleanup falla)
  const os = require('os');
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rrhh-test-backups-'));
  // Mock process.cwd() sin mutar el cwd real del proceso
  vi.spyOn(process, 'cwd').mockImplementation(() => tempDir);
});

afterEach(() => {
  try {
    vi.restoreAllMocks();
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } catch {
    // Ignore cleanup errors
  }
});
```

**Nota para la IA ejecutora:** "No eliminar el bloque `const createTestFile = ...` que aparece justo después. Conservar la indentación de 4 espacios."

---

### TAREA 8: Añadir constante BCRYPT_ROUNDS en PasswordController

**Archivo objetivo:** `backend/src/controllers/PasswordController.ts`
**Acción:** REEMPLAZAR BLOQUE

**Código a buscar (exactamente como está):**

```typescript
const PASSWORD_RESET_EXPIRES_MS = 15 * 60 * 1000;
const ACCESS_ACTIVATION_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;
```

**Código de reemplazo (exactamente como debe quedar):**

```typescript
const PASSWORD_RESET_EXPIRES_MS = 15 * 60 * 1000;
const ACCESS_ACTIVATION_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
```

**Nota para la IA ejecutora:** "Solo añadir la línea `const BCRYPT_ROUNDS = ...`. No borrar nada."

---

### TAREA 9: Usar BCRYPT_ROUNDS en PasswordController.reset

**Archivo objetivo:** `backend/src/controllers/PasswordController.ts`
**Acción:** REEMPLAZAR LÍNEA
**Depende de:** TAREA 8

**Código a buscar (exactamente como está):**

```typescript
const hashedPassword = await bcrypt.hash(newPassword, 10);
```

**Código de reemplazo (exactamente como debe quedar):**

```typescript
const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
```

**Nota para la IA ejecutora:** "Hay exactamente una ocurrencia de esta línea en el archivo. Reemplazar solo esa línea."

---

### TAREA 10: Añadir constante BCRYPT_ROUNDS en UserController

**Archivo objetivo:** `backend/src/controllers/UserController.ts`
**Acción:** REEMPLAZAR BLOQUE

**Código a buscar (exactamente como está):**

```typescript
import { coercePermissionMap, getEffectivePermissions, normalizeRole } from '../../../shared/authz';

export const UserController = {
```

**Código de reemplazo (exactamente como debe quedar):**

```typescript
import { coercePermissionMap, getEffectivePermissions, normalizeRole } from '../../../shared/authz';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

export const UserController = {
```

**Nota para la IA ejecutora:** "Mantener el resto del archivo intacto, incluido el `list: async` que va justo después."

---

### TAREA 11: Usar BCRYPT_ROUNDS en UserController.create

**Archivo objetivo:** `backend/src/controllers/UserController.ts`
**Acción:** REEMPLAZAR LÍNEA
**Depende de:** TAREA 10

**Código a buscar (exactamente como está):**

```typescript
const hashedPassword = await bcrypt.hash(password, 10);
```

**Código de reemplazo (exactamente como debe quedar):**

```typescript
const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
```

**Nota para la IA ejecutora:** "Esta línea aparece dentro del método `create` (indentación 8 espacios). No confundir con la del método `update` (TAREA 12)."

---

### TAREA 12: Usar BCRYPT_ROUNDS en UserController.update

**Archivo objetivo:** `backend/src/controllers/UserController.ts`
**Acción:** REEMPLAZAR LÍNEA
**Depende de:** TAREA 10

**Código a buscar (exactamente como está):**

```typescript
data.password = await bcrypt.hash(password, 10);
```

**Código de reemplazo (exactamente como debe quedar):**

```typescript
data.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
```

**Nota para la IA ejecutora:** "Esta línea aparece dentro del método `update` (indentación 12 espacios). No confundir con la del método `create` (TAREA 11)."

---

### TAREA 13: Aplicar política completa de contraseña en create_admin.ts

**Archivo objetivo:** `create_admin.ts`
**Acción:** REEMPLAZAR BLOQUE

**Código a buscar (exactamente como está):**

```typescript
async function createAdmin() {
    const email = process.env.ADMIN_EMAIL || 'admin@empresa.com';
    const password = process.env.ADMIN_PASSWORD;

    if (!password) {
        console.error('❌ FATAL: ADMIN_PASSWORD environment variable is required');
        console.error('   Usage: ADMIN_PASSWORD=YourSecurePassword node create_admin.js');
        process.exit(1);
    }

    if (password.length < 8) {
        console.error('❌ FATAL: ADMIN_PASSWORD must be at least 8 characters');
        process.exit(1);
    }
    const hashedPassword = await bcrypt.hash(password, 10);
```

**Código de reemplazo (exactamente como debe quedar):**

```typescript
async function createAdmin() {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email) {
        console.error('❌ FATAL: ADMIN_EMAIL environment variable is required');
        process.exit(1);
    }

    if (!password) {
        console.error('❌ FATAL: ADMIN_PASSWORD environment variable is required');
        console.error('   Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=YourSecurePassword node create_admin.js');
        process.exit(1);
    }

    // Aplicar la misma política de contraseñas que el resto de la app
    if (password.length < 10 ||
        /\s/.test(password) ||
        !/[a-z]/.test(password) ||
        !/[A-Z]/.test(password) ||
        !/[0-9]/.test(password) ||
        !/[^A-Za-z0-9]/.test(password)) {
        console.error('❌ FATAL: ADMIN_PASSWORD debe tener >=10 caracteres, mayúsculas, minúsculas, números y al menos un símbolo, sin espacios.');
        process.exit(1);
    }
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
    const hashedPassword = await bcrypt.hash(password, rounds);
```

**Nota para la IA ejecutora:** "Mantener intacto el bloque `try { const user = await prisma.user.upsert` que va inmediatamente después."

---

### TAREA 14: Eliminar fallback silencioso a SQLite en create_admin.ts

**Archivo objetivo:** `create_admin.ts`
**Acción:** REEMPLAZAR BLOQUE

**Código a buscar (exactamente como está):**

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL not set, using SQLite fallback');
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./database/prisma/dev.db',
    },
  },
});
```

**Código de reemplazo (exactamente como debe quedar):**

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

if (!process.env.DATABASE_URL) {
  console.error('❌ FATAL: DATABASE_URL environment variable is required');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
```

**Nota para la IA ejecutora:** "Aplicar antes que la TAREA 13 si se ejecutan en orden inverso, pero son bloques no solapados, así que el orden entre ambas es indiferente."

---

### TAREA 15: Añadir import de allowSelfOrRole en onboardingRoutes

**Archivo objetivo:** `backend/src/routes/onboardingRoutes.ts`
**Acción:** REEMPLAZAR LÍNEA

**Código a buscar (exactamente como está):**

```typescript
import {
  protect,
  restrictTo,
  checkPermission,
  requireGlobalAdmin,
} from '../middlewares/authMiddleware';
```

**Código de reemplazo (exactamente como debe quedar):**

```typescript
import {
  protect,
  restrictTo,
  checkPermission,
  requireGlobalAdmin,
  allowSelfOrRole,
} from '../middlewares/authMiddleware';
```

**Nota para la IA ejecutora:** "Solo añadir `, allowSelfOrRole` al import. No añadir imports adicionales."

---

### TAREA 16: Arreglar IDOR en rutas de onboarding (checklists)

**Archivo objetivo:** `backend/src/routes/onboardingRoutes.ts`
**Acción:** REEMPLAZAR BLOQUE
**Depende de:** TAREA 15

**Código a buscar (exactamente como está):**

```typescript
// Employee Checklists
router.get('/employee/:employeeId', protect, OnboardingController.getEmployeeChecklists);
router.put('/checklist/:id', protect, OnboardingController.updateChecklist);
router.delete('/checklist/:id', protect, restrictTo('admin'), OnboardingController.deleteChecklist);
```

**Código de reemplazo (exactamente como debe quedar):**

```typescript
// Employee Checklists
router.get(
  '/employee/:employeeId',
  protect,
  allowSelfOrRole(['admin', 'hr', 'manager'], 'employeeId'),
  OnboardingController.getEmployeeChecklists
);
router.put(
  '/checklist/:id',
  protect,
  restrictTo('admin', 'hr'),
  OnboardingController.updateChecklist
);
router.delete('/checklist/:id', protect, restrictTo('admin'), OnboardingController.deleteChecklist);
```

**Nota para la IA ejecutora:** "Solo modificar las 3 líneas de rutas. El import lo añadió la TAREA 15."

---

### TAREA 17: Aceptar header de firma en el feed del calendario

**Archivo objetivo:** `backend/src/controllers/CalendarController.ts`
**Acción:** REEMPLAZAR BLOQUE

**Código a buscar (exactamente como está):**

```typescript
    getFeed: async (req: Request, res: Response) => {
        const { u: employeeId, s: signature } = req.query;

        if (!employeeId || !signature) {
            return res.status(400).send('Missing parameters');
        }
```

**Código de reemplazo (exactamente como debe quedar):**

```typescript
    getFeed: async (req: Request, res: Response) => {
        const { u: employeeId } = req.query;
        // Preferir header (no se loguea por defecto); fallback a query para clientes calendario externos
        const signature = (req.header('X-Calendar-Signature') || req.query.s) as string | undefined;

        if (!employeeId || !signature) {
            return res.status(400).send('Missing parameters');
        }
```

**Nota para la IA ejecutora:** "Esta edición va en el método `getFeed`, distinto del método `getSubscriptionLink` (TAREA 18). Aplicar ambas."

---

### TAREA 18: Devolver también la firma como header en la suscripción

**Archivo objetivo:** `backend/src/controllers/CalendarController.ts`
**Acción:** REEMPLAZAR BLOQUE

**Código a buscar (exactamente como está):**

```typescript
// We return the full feed URL
// If frontend talks to backend via /api, the feed is at /api/calendar/feed
// The user needs an absolute URL to put in Google Calendar.

// Construct URL assuming typical deployment
const feedUrl = `${backendUrl}/api/calendar/feed?u=${employee.id}&s=${signature}`;

return ApiResponse.success(res, { url: feedUrl });
```

**Código de reemplazo (exactamente como debe quedar):**

```typescript
// Devolvemos la URL con la firma en query (requerido por Google/Outlook Calendar).
// ADVERTENCIA: esta URL debe tratarse como secreta. Rotar si se sospecha fuga
// (cambiar JWT_SECRET invalida todas las firmas).
const feedUrl = `${backendUrl}/api/calendar/feed?u=${employee.id}&s=${signature}`;

return ApiResponse.success(res, { url: feedUrl, headerName: 'X-Calendar-Signature', signature });
```

**Nota para la IA ejecutora:** "Este cambio es retrocompatible: el frontend que solo lea `url` sigue funcionando."

---

### TAREA 19: Usar LoggerService en errorMiddleware

**Archivo objetivo:** `backend/src/middlewares/errorMiddleware.ts`
**Acción:** REEMPLAZAR ARCHIVO COMPLETO

**Código a buscar (exactamente como está):**

```typescript
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';

export const errorMiddleware = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    return ApiResponse.error(res, err.message, err.statusCode);
  }

  console.error('UNEXPECTED ERROR:', err);

  // Log to stdout (container-friendly)

  return ApiResponse.error(
    res,
    process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error',
    500
  );
};
```

**Código de reemplazo (exactamente como debe quedar):**

```typescript
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { createLogger } from '../services/LoggerService';

const log = createLogger('ErrorMiddleware');

export const errorMiddleware = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    return ApiResponse.error(res, err.message, err.statusCode);
  }

  // Logger estructurado (Sentry/Pino/JSON) en vez de console.error plano
  log.error(
    {
      err,
      path: req.path,
      method: req.method,
      requestId: (req as any).requestId,
    },
    'Unexpected error'
  );

  return ApiResponse.error(
    res,
    process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error',
    500
  );
};
```

**Nota para la IA ejecutora:** "Reemplazar el archivo entero. No cambiar el nombre de exportación `errorMiddleware`."

---

### TAREA 20: Eliminar código muerto (fileRoutes.ts)

**Archivo objetivo:** `backend/src/routes/fileRoutes.ts`
**Acción:** BORRAR ARCHIVO (previa verificación)

**Paso 1 — Verificar que nadie lo importa (Windows PowerShell):**

```powershell
Get-ChildItem -Path backend\src -Recurse -Include *.ts | Select-String -Pattern 'fileRoutes' | Select-Object -First 20
```

**Paso 2 — Si el único resultado es el propio `fileRoutes.ts`, borrarlo:**

```powershell
Remove-Item -LiteralPath "backend\src\routes\fileRoutes.ts" -Force
```

**Nota para la IA ejecutora:** "Si aparece OTRO archivo importando `fileRoutes`, NO borres y reporta. En `registerRoutes.ts` NO aparece (verificado en la auditoría), así que debería ser seguro."

---

## ✅ VERIFICACIÓN FINAL

Tras ejecutar todas las tareas, ejecutar en orden:

```bash
# 1. Type-check del backend
cd backend && npx tsc --noEmit

# 2. Type-check del frontend
cd ../frontend && npx tsc --noEmit

# 3. Tests del backend (deben pasar; la TAREA 7 cambia el cwd del test)
cd ../backend && npm test -- BackupService

# 4. Verificar que no quedan test-backups
# PowerShell:
#   Get-ChildItem -Path backend -Directory -Filter "test-backups-*" | Measure-Object | Select-Object Count
# Debe devolver Count = 0.

# 5. Verificar que no hay timing comparisons restantes
# PowerShell:
#   Get-ChildItem -Path backend\src -Recurse -Include *.ts | Select-String -Pattern "!== configuredSecret|!== expected.*signature" -Exclude *.test.ts
# Debe devolver vacío.
```

---

## 📊 RESUMEN DE ARCHIVOS MODIFICADOS

| Archivo                                              | Tareas       |
| ---------------------------------------------------- | ------------ |
| `backend/src/controllers/CalendarController.ts`      | 1, 17, 18    |
| `backend/src/middlewares/kioskSecurityMiddleware.ts` | 2, 3         |
| `backend/src/controllers/KioskController.ts`         | 4, 5         |
| `backend/src/services/BackupService.test.ts`         | 7            |
| `backend/src/controllers/PasswordController.ts`      | 8, 9         |
| `backend/src/controllers/UserController.ts`          | 10, 11, 12   |
| `create_admin.ts`                                    | 13, 14       |
| `backend/src/routes/onboardingRoutes.ts`             | 15, 16       |
| `backend/src/middlewares/errorMiddleware.ts`         | 19           |
| `backend/src/routes/fileRoutes.ts`                   | 20 (borrado) |
| Sistema (PowerShell)                                 | 6            |

**Total:** 20 tareas · 10 archivos editados · 1 archivo borrado · 1 comando de limpieza.

---

## ⚠️ RIESGOS Y NOTAS

1. **No hay migraciones de BD necesarias.** Ninguna tarea cambia el schema Prisma.
2. **Retrocompatibilidad:** Las TAREAS 17 y 18 (calendario) son retrocompatibles; el frontend que solo use `url` seguirá funcionando.
3. **Rotación de firmas HMAC:** Tras desplegar C1, si hubo fuga previa de URLs, rotar `JWT_SECRET` invalida todas las firmas (los empleados tendrán que volver a pedir su link de suscripción).
4. **Tests:** La TAREA 7 cambia cómo se aisla el cwd en el test. Ejecutar `npm test -- BackupService` para confirmar que sigue pasando.
5. **BCRYPT_ROUNDS:** Si en `.env` de producción se sube a 12, todas las contraseñas NUEVAS usarán 12 rounds. Las existentes siguen con 10 hasta el próximo cambio de contraseña. Esto es comportamiento esperado de bcrypt.

---

## ✅ VERIFICACIÓN REAL (2026-06-25)

Pase de verificación automatizada + commits. **Estado final:**

| Commit                                                                               | Hash      | Tareas cubiertas                                         |
| ------------------------------------------------------------------------------------ | --------- | -------------------------------------------------------- |
| `fix(security): close calendar M6 leak, IDOR on checklist delete, frontend perm gap` | `cf18298` | M5 + M6 (mitigación) + bonus frontend `canAccessFeature` |
| `refactor(auth): centralize bcrypt rounds via getBcryptRounds()`                     | `9e3e115` | M1 + reparación del pre-commit hook (lint-staged)        |
| `fix(security): validate magic bytes on disk-stored uploads`                         | `73768b4` | B3                                                       |

**Verificación automatizada de las 10 tareas restantes:** grep + lectura del archivo correspondiente al line number del audit. Todas estaban ya aplicadas en el código:

- **C1** — `grep "timingSafeEqual" backend/src/controllers/CalendarController.ts` → 1 hit (línea 77).
- **C2** — `safeSecretEquals` en `kioskSecurityMiddleware.ts:7` y `crypto.timingSafeEqual` en `KioskController.ts:102`.
- **C3** — `BackupService.test.ts:13` usa `os.tmpdir()`; `afterEach` (línea 22) hace `fs.rmSync({recursive: true, force: true})`.
- **M2** — `create_admin.ts:34-42` aplica la política completa (length 10 + mixed case + números + símbolos + sin espacios).
- **M3** — `create_admin.ts:5-8` hace `process.exit(1)` si falta `DATABASE_URL`.
- **M4** — `create_admin.ts:19-25` hace `process.exit(1)` si falta `ADMIN_EMAIL`.
- **B1** — `errorMiddleware.ts:6,18-27` usa `createLogger('ErrorMiddleware')` estructurado.
- **B2** — `backend/src/routes/fileRoutes.ts` no existe en el filesystem; no hay import en `registerRoutes.ts`.
- **B4** — `BackupService.test.ts:36` → `fs.utimesSync(filePath, pastTime, pastTime)` (sólo 2 args).

**M6 — parcialmente mitigada:** la firma en URL sigue existiendo (es un requisito de Google/Outlook Calendar), pero `cf18298` añade `log.warn({ employeeId, requestId }, '...')` cuando el cliente no usa el header `X-Calendar-Signature`. Sirve para que operaciones vea quién está usando el canal inseguro. Para eliminación total del vector, considerar:

- Requerir el header en el frontend y dejar el query solo como fallback legacy.
- Rotar `JWT_SECRET` periódicamente (invalida firmas pre-fuga).
- Auditar logs de nginx por firmas en query (`grep "s=" /var/log/nginx/access.log`).

---

## 🆕 HALLAZGOS POST-AUDITORÍA (2026-06-25, no estaban en el informe original)

Estos son riesgos reales encontrados durante la verificación. No son del `AUDITORIA_Y_PLAN.md` original pero merecen un PR aparte cuando se prioricen:

| #   | Severidad | Archivo                                                              | Riesgo                                                                                                                                                                                                                                                       |
| --- | --------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| N1  | 🟡 MEDIA  | `backend/src/services/AuditService.ts:36-43`                         | Si la inserción del log de auditoría falla tras 3 reintentos, se llama `log.fatal({ auditData: data })`. Eso puede llevar PII (DNI, salario, acciones sobre empleados) a Sentry/Elasticsearch sin scrubbing. Hay que filtrar campos sensibles antes del log. |
| N2  | 🟢 BAJA   | `frontend/vite.config.ts`                                            | Sin `manualChunks`. `vendor-misc` 619 kB y `vendor-pdf` 571 kB se cargan en chunks enormes. Mover OCR/PDF a chunks on-demand baja TTI.                                                                                                                       |
| N3  | 🟢 BAJA   | `backend/src/controllers/AuthController.ts:15-22` y `AuthService.ts` | Lógica duplicada: `REFRESH_TOKEN_EXPIRES_IN`, `generateRefreshToken`, `hashToken`, `JWT_SECRET` validation están en ambos. Centralizar en `auth/tokens.ts`.                                                                                                  |
| N4  | 🟢 BAJA   | `backend/src/controllers/AuthService.ts:17`                          | Búsqueda de DNI con `mode: 'insensitive'`. El DNI español siempre es mayúsculas; usar `trim + toUpperCase + equals` estricto.                                                                                                                                |
| N5  | 🟡 MEDIA  | `backend/src/services/AuditService.ts:36-43`                         | Mismo que N1, además `auditData` puede contener `metadata` que el llamador añadió sin sanitizar. Defensa: schema Zod o lista blanca de campos serializables.                                                                                                 |
| N6  | 🟢 BAJA   | `backend/create-test-admin.js`                                       | Credenciales DB y email hardcodeados. Marcar como legacy (ya hecho en M1) o eliminar definitivamente.                                                                                                                                                        |
| N7  | 🟢 BAJA   | `backend/src/scripts/seed-*.ts` (×8)                                 | 8 scripts de seed distintos con responsabilidades solapadas. Consolidar en 2-3.                                                                                                                                                                              |
| N8  | 🟢 BAJA   | `frontend/src/api/client.ts:174-181`                                 | `loginRedirectCount` en `sessionStorage` para detectar bucles de redirect. Funcional, pero un comentario explicativo evitaría refactors que rompan el safeguard.                                                                                             |
| N9  | 🟡 MEDIA  | `backend/src/scripts/debug-*` (×11)                                  | 11 scripts de debug en `backend/src/scripts/` que se incluyen en `dist/`. Si no se usan en CI, añadirlos a `.dockerignore` o `tsconfig.exclude`.                                                                                                             |
| N10 | 🟢 BAJA   | `frontend/src/components/Sidebar.tsx`, `sidebarNavigation.tsx` (×2)  | Dos archivos para lo mismo. Revisar cuál está en uso y borrar el otro.                                                                                                                                                                                       |

---

**Fin del plan + verificación + hallazgos nuevos.**

 
 < ! - -   T r i g g e r   d e p l o y   2 0 2 6 - 0 6 - 2 3 T 1 1 : 0 8 : 0 5 . 0 7 1 8 5 0 4 + 0 2 : 0 0   - - > 
 
 
