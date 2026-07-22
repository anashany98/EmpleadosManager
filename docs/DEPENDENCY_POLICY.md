# Política de Dependencias (IMP-004)

Esta política aplica a `backend/` y `frontend/`. Define cómo añadir,
actualizar y mantener dependencias de forma que (a) las vulnerabilidades
conocidas se cierren rápido, (b) las breaking changes no nos pillen en
producción, y (c) la separación dev/prod sea verificable por CI.

## TL;DR

| Acción                       | Cómo                                                             | Quién                |
| ---------------------------- | ---------------------------------------------------------------- | -------------------- |
| Añadir dep nueva             | PR con justificación + link al CVE/issue que la motiva           | Dev que la necesita  |
| Update patch                 | Automerged por Renovate los lunes                                | Bot                  |
| Update minor (security-deps) | Automerged el lunes                                              | Bot                  |
| Update minor (resto)         | PR con Renovate, revisión manual                                 | Dev asignado         |
| Update major                 | PR con Renovate, **siempre** revisión manual + plan de migración | Dev asignado         |
| CVE crítico                  | Renovate abre PR inmediato, prioridad P0                         | Dev asignado         |
| DevDep vulnerable            | Bloquea el install local (`audit-level=high` en `.npmrc`)        | Dev que la introdujo |

## Reglas

### 1. Lockfile (`package-lock.json`) SIEMPRE commiteado

El lockfile es la fuente de verdad de qué versión exacta se instala
en cada entorno. Sin lockfile commiteado, dos instalaciones de la
misma `package.json` pueden dar árboles de deps distintos (y por
tanto, comportamientos distintos).

**`backend/.npmrc` y `frontend/.npmrc` tienen `package-lock=true`**
para impedir `npm install` sin lockfile. El job `dep-policy` en CI
verifica que `package-lock.json` existe y está sincronizado con
`package.json`.

### 2. Separación dev / prod

Las dependencias de build y test (`@types/*`, `vitest`, `eslint`,
`ts-node`, etc.) van a `devDependencies`. Cualquier dep en
`dependencies` se incluye en el build de producción, en el
`Dockerfile` final, y se evalúa contra `npm audit --omit=dev`.

**El job `dep-policy` falla si detecta `devDependencies` que se
importan desde código de runtime** (análisis estático de imports).
Para las que SÍ son necesarias en runtime, se mueven a
`dependencies` antes de mergear.

### 3. Versionado

- **Caret (`^x.y.z`)**: default. Permite patch + minor dentro de la
  misma major.
- **Tilde (`~x.y.z`)**: para deps que en sus minor bumps rompen API
  (raro; por ejemplo `pino-pretty`). Decisión por dep, no global.
- **Exacto (`x.y.z`)**: para deps con historial de breaking changes
  silenciosos entre patch versions. Lista viva en este doc.

### 4. Auditoría

- **CI (job `security`)**: `npm audit --omit=dev --audit-level=high`
  para backend, frontend y root. Falla el build en HIGH o CRITICAL.
- **Local**: `npm run audit:check` (mismo comando). Cualquier dev
  puede correrlo antes de commitear.
- **`audit:full`**: incluye dev deps. Útil para detectar advisories
  en tooling de build, pero no rompe CI.
- **`.npmrc` con `audit-level=high`**: install local aborta si
  alguna dep (incluso dev) tiene advisory high+.

### 5. Renovate

`renovate.json` en la raíz configura el bot de actualización:

- **Patch + minor (security-deps)**: automerge el lunes a las 06:00.
  El CI valida tests, lint y build. Si algo falla, se reabre el PR.
- **Minor (resto)**: PR con revisión manual.
- **Major**: PR con label `breaking-change`, siempre revisión
  manual. Requiere plan de migración documentado en la descripción.
- **CVE crítico (`vulnerabilityAlerts`)**: PR inmediato, no espera
  al lunes. Asignado a `@anashany98`.
- **Lockfile maintenance**: semanal.

### 6. Paquetes vetados (no añadir)

Lista negra mantenida en `renovate.json` con `enabled: false`:

- `xlsx` (SheetJS): advisories críticos sin fix upstream. Usar
  `exceljs` (HIGH-007).
- `node-fetch`: 2.x tiene CVEs. Pinear a 2.7.0 o migrar a `fetch`
  nativo de Node 22.

## Excepciones documentadas

- `@prisma/client` y `prisma` están como `5.x` en `package.json`
  (en vez de `^5.22.0`). Esto es intencional: el runtime de Prisma
  requiere que cliente y CLI estén en la misma minor. Renovate los
  actualiza juntos, pero si se desincronizan, el schema migrate
  falla con un error claro. Aceptar este trade-off documentado.

- `socket.io-client` sigue en `^4.8.3` aunque hay `5.x` upstream
  con cambios incompatibles. Migrar requiere actualizar también
  `socket.io` server-side, lo que está en el backlog.

- `ws` (transitiva de `socket.io-client`) tiene advisory moderado.
  Esperar al bump mayor de socket.io-client (FIXME: track en
  auditoría cuando se cierre).

## Cómo añadir una dependencia nueva

1. **Justifica la decisión**: ¿Por qué esta y no otra? ¿Está
   mantenida? ¿Tiene advisories abiertos? ¿Cuántas transitive
   deps añade?
2. **Comprueba si ya existe**: `npm ls <nombre>` desde la raíz
   del workspace correspondiente.
3. **Instala con la versión exacta o caret, no `latest`**:
   `npm install <pkg>@<version>` o `npm install <pkg>` (npm
   resuelve a la última compatible con el semver declarado).
4. **Verifica que va al bloque correcto** (`dependencies` vs
   `devDependencies`). Si dudas, mira si se importa desde código
   de runtime (`src/` en backend, `src/` en frontend sin prefijo
   de test).
5. **Commitea `package.json` + `package-lock.json` juntos**.
6. **Espera a CI**: el job `security` corre `npm audit` y el job
   `build` compila. Si algo falla, NO force-merge.

## Cómo actualizar una dependencia manualmente (sin Renovate)

1. `npm outdated` para ver qué hay disponible.
2. `npm update <pkg>` para patch/minor dentro del semver.
3. `npm install <pkg>@latest` para major (cambia `package.json`
   y `package-lock.json`).
4. `npm test && npm run lint:strict && npm run build` en local.
5. PR con descripción de qué cambia y por qué.
