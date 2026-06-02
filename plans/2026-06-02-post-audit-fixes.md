# Plan de Solución — Issues Post-Auditoría 2026-06-02

**Fecha:** 2026-06-02
**Origen:** Auditoría completa de producción
**Score actual:** 85/100
**Score objetivo:** ≥95/100
**Autor:** Sisyphus

---

## 📋 Resumen Ejecutivo

La auditoría identificó **23 issues** distribuibles en 4 categorías:

| Categoría | # | Severidad |
|---|---|---|
| 🔴 **Bloqueantes para deploy** | 5 | Crítico |
| 🟠 **Seguridad / Integridad** | 6 | Alto |
| 🟡 **Validación de producción** | 7 | Medio |
| 🔵 **Higiene y pulido** | 5 | Bajo |

**Tiempo total estimado:** 2-3 días laborables (1 dev senior)

---

## FASE 0: Quick Wins (1-2 horas) — Desbloquea commit

> Objetivo: limpiar el árbol de trabajo para poder revisar y commitear los 56 archivos modificados.

### 0.1 Limpiar archivos huérfanos

| # | Acción | Archivo | Comando |
|---|---|---|---|
| 0.1.1 | Eliminar backup obsoleto de Reports | `frontend/src/pages/Reports.tsx.bak` | `Remove-Item -LiteralPath` |
| 0.1.2 | Verificar que `.bak` queda excluido | `.gitignore` | Añadir `*.bak` (ya cubierto por heurística, explicitar) |
| 0.1.3 | Eliminar PDFs basura que aún existen en repo | `backend/test2.pdf`, `backend/test3.pdf`, `backend/output.pdf` | `Remove-Item` |
| 0.1.4 | Eliminar logs de debugging | `backend/test_output*.txt`, `backend/test_write.txt`, `backend/test_final.txt` | `Remove-Item` |

**Criterio de aceptación:**
- `git status` solo lista los 56 archivos con cambios intencionales (no archivos generados)
- No quedan artefactos `*.bak`, `*.pdf` de test, ni `test_output_*.txt` en el árbol

### 0.2 Mover credenciales fuera del repo

| # | Acción | Archivo | Destino |
|---|---|---|---|
| 0.2.1 | Mover a `.gitignore` y a un vault externo | `DOCKER_DEPLOYMENT_CREDENTIALS.md` | Vault 1Password / fuera del repo |
| 0.2.2 | Mover a vault externo | `DEPLOY_HOSTINGER_PRIVADO.md` | Vault 1Password / fuera del repo |
| 0.2.3 | Añadir reglas en `.gitignore` | `.gitignore` | Añadir `*CREDENTIALS*.md` y `*PRIVADO*.md` |
| 0.2.4 | Verificar que NO están en historial | `git log --all --full-history -- "DOCKER_DEPLOYMENT_CREDENTIALS.md"` | Si aparecen, redactar con `git filter-repo` o `BFG` |

**Criterio de aceptación:**
- Ambos archivos ya no están en el árbol
- `.gitignore` previene su re-adición accidental
- `git log --all` confirma que no hay credenciales activas en historial (o están redactadas)

### 0.3 Verificar `git diff` por archivo modificado (revisión rápida)

Para CADA uno de los 56 archivos modificados:

| # | Acción | Comando |
|---|---|---|
| 0.3.1 | Listar archivos con cambio | `git diff --name-only` |
| 0.3.2 | Revisar diff de archivos sensibles (auth, security, csrf) | `git diff backend/src/controllers/AuthController.ts`, `git diff backend/src/services/AuthService.ts`, `git diff backend/src/middlewares/authMiddleware.ts`, `git diff backend/src/middlewares/csrfMiddleware.ts` |
| 0.3.3 | Verificar que ningún cambio introduce secretos | `git diff` con grep de `secret`, `password`, `key` (case-insensitive) |

**Criterio de aceptación:**
- Cada diff revisado por humano o agente auditor
- Ningún diff introduce credenciales, console.log de tokens, o disable de security checks

---

## FASE 1: Seguridad Crítica (3-4 horas) — Bloqueante

> Objetivo: cerrar huecos detectados en auth y configuración de producción.

### 1.1 Validar que los cambios en Auth no debilitan el módulo

| # | Problema potencial | Archivo | Verificación |
|---|---|---|---|
| 1.1.1 | ¿Se mantiene `sessionVersion` check? | `authMiddleware.ts` | Confirmar que `decoded.sessionVersion !== user.sessionVersion` rechaza tokens viejos |
| 1.1.2 | ¿Se mantiene CSRF en métodos no-GET? | `csrfMiddleware.ts` + `client.ts` | Confirmar header `X-CSRF-Token` se envía en POST/PUT/PATCH/DELETE |
| 1.1.3 | ¿El rate limiter de login sigue activo? | `authRoutes.ts` | Confirmar `loginLimiter` antes de `AuthController.login` |
| 1.1.4 | ¿Account lockout se chequea? | `authRoutes.ts` + `AuthService.ts` | Confirmar `checkAccountLockout` middleware |
| 1.1.5 | ¿JWT_SECRET se valida al arranque? | `configValidator.ts` | Confirmar validator rechaza `JWT_SECRET` < 32 chars o placeholders |

**Criterio de aceptación:**
- Tests de `authMiddleware.test.ts`, `AuthController.test.ts`, `AuthService.test.ts`, `csrfMiddleware.test.ts` (existe) pasan al 100%
- Ejecutar `npm test -- backend/src/tests/integration/auth-flow.test.ts` → verde

### 1.2 Rotar TODAS las claves de producción (NO commitear al repo)

| # | Variable | Longitud | Cómo generar |
|---|---|---|---|
| 1.2.1 | `JWT_SECRET` | ≥32 bytes random | `openssl rand -base64 48` |
| 1.2.2 | `ENCRYPTION_KEY` | exactamente 32 chars | `openssl rand -hex 16` |
| 1.2.3 | `BACKUP_ENCRYPTION_KEY` | ≥32 bytes random | `openssl rand -base64 48` |
| 1.2.4 | `POSTGRES_PASSWORD` | ≥24 chars alfanumérico | `openssl rand -base64 24` |
| 1.2.5 | `REDIS_PASSWORD` | ≥16 chars | `openssl rand -base64 18` |
| 1.2.6 | `KIOSK_DEVICE_SECRET` | ≥32 bytes | `openssl rand -base64 48` |
| 1.2.7 | Cookie de sesión (CSRF) | n/a | Generar en runtime, no estática |

**Almacenamiento:** Vault 1Password / Bitwarden / Coolify Secrets UI. NUNCA en `.env` commiteado.

**Criterio de aceptación:**
- Todas las claves nuevas generadas
- Verificar con `configValidator.ts` que las claves pasan validación (arrancar local con `NODE_ENV=production` y claves reales)
- Verificar que ninguna clave de test (`test-jwt-secret-for-ci`, `12345678901234567890123456789012`, `test_pass`, `nominas_local_pw_2026`) está presente

### 1.3 Verificar configuración S3 real

| # | Verificación | Cómo |
|---|---|---|
| 1.3.1 | Bucket S3 existe y es accesible | `aws s3 ls s3://$S3_BUCKET` con credenciales |
| 1.3.2 | Permisos IAM correctos (PutObject, GetObject, DeleteObject) | Probar upload/download manual |
| 1.3.3 | Política de bucket no es pública | Revisar en consola AWS/MinIO |
| 1.3.4 | Cifrado server-side habilitado (SSE-S3 o SSE-KMS) | Configurar bucket |
| 1.3.5 | Lifecycle policy: backups antiguos → Glacier después de 30 días | Configurar |
| 1.3.6 | Versioning habilitado (recuperación de errores) | Configurar |

**Criterio de aceptación:**
- Test upload desde el backend: ejecutar `BackupService.createFullBackup()` con `BACKUP_UPLOAD=true` y verificar objeto en S3
- Verificar que el objeto está cifrado en S3 (header `x-amz-server-side-encryption`)

### 1.4 Verificar configuración SMTP real (no Ethereal)

| # | Verificación | Cómo |
|---|---|---|
| 1.4.1 | Credenciales SMTP válidas (Gmail Workspace, SendGrid, Mailgun, etc.) | Panel del proveedor |
| 1.4.2 | SPF + DKIM + DMARC configurados en DNS | `dig TXT emitempresa.com` y panel DNS |
| 1.4.3 | From address válido (`noreply@emitempresa.com`) | Verificar rebote configurado |
| 1.4.4 | Test email se envía y llega | Usar `POST /api/config/smtp/test` con email propio |

**Criterio de aceptación:**
- Email de prueba llega a la bandeja (NO spam)
- Headers `Authentication-Results` muestran `spf=pass`, `dkim=pass`, `dmarc=pass`
- Si el log muestra `📧 Ethereal Ready` en producción, BLOQUEAR deploy

### 1.5 Verificar Sentry está capturando errores

| # | Verificación | Cómo |
|---|---|---|
| 1.5.1 | `SENTRY_DSN` configurado y válido | `echo $SENTRY_DSN \| curl -X POST "$SENTRY_DSN/api/0/envelope/"` |
| 1.5.2 | Proyecto de Sentry creado en sentry.io | Manual en panel |
| 1.5.3 | Alertas configuradas (ej: 5 errores en 10min) | Manual en panel Sentry |
| 1.5.4 | Test event se recibe | Provocar error 500 controlado y verificar en Sentry |

**Criterio de aceptación:**
- Eventos aparecen en Sentry en <30 segundos
- Source maps subidos (releases con `SENTRY_RELEASE=$GIT_SHA`)

---

## FASE 2: Validación de Producción (1-2 días) — Bloqueante

> Objetivo: probar todo el stack end-to-end antes de apuntar al dominio real.

### 2.1 Smoke test del stack Docker completo

| # | Acción | Comando / Cómo |
|---|---|---|
| 2.1.1 | Levantar stack limpio | `docker compose down -v && docker compose up -d` |
| 2.1.2 | Verificar que Postgres arranca | `docker logs manager_db \| grep "database system is ready"` |
| 2.1.3 | Verificar que Redis arranca | `docker exec manager_redis redis-cli -a $REDIS_PASSWORD ping` |
| 2.1.4 | Verificar que backend arranca | `curl http://localhost:16161/api/health/liveness` |
| 2.1.5 | Verificar que frontend arranca | `curl http://localhost:17171/` |
| 2.1.6 | Verificar que nginx enruta | `curl -I https://localhost/api/health` |
| 2.1.7 | Ejecutar migraciones | `npm run db:migrate` |
| 2.1.8 | Seed inicial | `npm run seed:admin` |
| 2.1.9 | Backup inicial funciona | Trigger manual y verificar en S3 |

**Criterio de aceptación:**
- Todos los 6 contenedores en estado `healthy` (`docker compose ps`)
- Liveness, readiness, health endpoints todos devuelven 200
- Backup completo aparece en S3 con cifrado

### 2.2 Test funcional end-to-end (manejado por script Playwright)

| # | Flujo | Pasos |
|---|---|---|
| 2.2.1 | Login admin | Navegar a `/login`, introducir admin, redirect a `/` |
| 2.2.2 | Crear empleado | `/employees` → nuevo → rellenar → guardar |
| 2.2.3 | Subir documento | En ficha empleado → Documents → upload PDF |
| 2.2.4 | Fichar entrada (kiosk) | `/kiosk` → DNI/PIN → entrada |
| 2.2.5 | Crear ausencia | Calendar → nueva → seleccionar fechas |
| 2.2.6 | Aprobar ausencia | Como manager, aprobar |
| 2.2.7 | Importar nóminas | `/import` → upload Excel |
| 2.2.8 | Generar PDF nómina | Detalle de lote → export PDF |
| 2.2.9 | WebSocket lock | Abrir mismo empleado en 2 navegadores → ver banner "bloqueado por..." |
| 2.2.10 | Logout | Header → logout → redirect a `/login` |

**Criterio de aceptación:**
- Script Playwright (en `test/` o nuevo `e2e/`) corre los 10 flujos sin errores
- Screenshots de cada paso archivados para auditoría

### 2.3 Test de carga (4-6 usuarios concurrentes)

| # | Acción | Herramienta |
|---|---|---|
| 2.3.1 | Crear 6 usuarios de prueba | Seed script |
| 2.3.2 | Simular navegación simultánea | k6 / autocannon |
| 2.3.3 | Medir P95 latency por endpoint | Verificar <500ms para endpoints CRUD |
| 2.3.4 | Verificar no hay memory leak | Heap estable tras 30min |
| 2.3.5 | Verificar BullMQ no se atasca | Cola `ingestion-queue` con <100 pending |

**Criterio de aceptación:**
- 6 usuarios simultáneos durante 30 minutos sin errores 5xx
- P95 < 500ms en endpoints principales
- Memoria del proceso backend estable (no crece >10% en 30min)

### 2.4 Test de recuperación de desastres

| # | Escenario | Procedimiento |
|---|---|---|
| 2.4.1 | Restaurar backup completo | `pg_restore` + descomprimir uploads → verificar datos |
| 2.4.2 | Restaurar solo snapshot DB | `pg_restore` del dump |
| 2.4.3 | Failover de Redis (caída) | Reiniciar Redis, verificar que backend reconecta |
| 2.4.4 | Failover de Postgres (caída) | Reiniciar Postgres, verificar migraciones no se pierden |
| 2.4.5 | S3 no disponible | Poner credenciales inválidas, verificar que backend degrada con error claro (no crash) |

**Criterio de aceptación:**
- Backup completo se restaura en <30 min
- Tras caída de Redis, backend se recupera en <2 min (reconnect automático ioredis)
- Tras caída de Postgres, backend espera reconexión sin perder requests

### 2.5 Verificar HTTPS y certificados

| # | Verificación | Cómo |
|---|---|---|
| 2.5.1 | Let's Encrypt emite cert | `certbot --nginx -d rrhh.emitempresa.com` |
| 2.5.2 | Renovación automática configurada | Cron o systemd timer |
| 2.5.3 | SSL Labs score ≥ A | `https://www.ssllabs.com/ssltest/` |
| 2.5.4 | HSTS preload submission | https://hstspreload.org/ (opcional) |

**Criterio de aceptación:**
- `curl -I https://rrhh.emitempresa.com` devuelve 200 con `Strict-Transport-Security`
- SSL Labs A o A+
- Renovación automática probada (renovar manualmente y verificar)

### 2.6 Test de migración de datos (si vienes de SQLite dev)

| # | Verificación |
|---|---|
| 2.6.1 | Si NO hay datos previos, omitir este paso |
| 2.6.2 | Si hay datos: `pg_dump` desde SQLite → script ETL → cargar a Postgres |
| 2.6.3 | Verificar counts: mismos números de empleados, vacaciones, documentos |
| 2.6.4 | Verificar cifrado: datos sensibles descifran correctamente |

---

## FASE 3: Higiene y Refactors Menores (4-6 horas) — No bloqueante

> Objetivo: limpiar deuda técnica identificada.

### 3.1 Eliminar queue `ocr-queue` no usada

| # | Archivo | Acción |
|---|---|---|
| 3.1.1 | `backend/src/services/QueueService.ts:56-59` | Quitar `OCR: 'ocr-queue'` de `QUEUES` |
| 3.1.2 | `backend/src/services/HealthChecker.ts:299` | Quitar `'ocr-queue'` del check de colas |
| 3.1.3 | Verificar que ningún producer la usa | `grep -r "OCR\b" backend/src --include="*.ts"` |
| 3.1.4 | Si se necesita OCR async en el futuro, re-registrar con worker real | TODO documentado |

**Criterio de aceptación:**
- `grep` no encuentra referencias a `ocr-queue` en código activo
- Tests de QueueService siguen pasando

### 3.2 Decidir uso de `node-cron` vs `setInterval`

| # | Hallazgo | Decisión recomendada |
|---|---|---|
| 3.2.1 | `node-cron` está en `package.json` pero no se usa directamente; `SchedulerService` usa `setInterval` | Opción A: usar `node-cron` para expresividad de cron strings (más legible que `setInterval(6*60*60*1000)`) |
| 3.2.2 | Si se decide reemplazar: `cron.schedule('0 */6 * * *', runAlerts)` | Más mantenible |
| 3.2.3 | Si se decide dejar: documentar en comentario por qué se eligió `setInterval` | Decisión consciente |

**Criterio de aceptación:**
- Decisión tomada y reflejada en código o comentario
- Si se migra a `node-cron`, los tests existentes siguen pasando

### 3.3 Documentar flujo IMAP en README

| # | Acción |
|---|---|
| 3.3.1 | Añadir sección en `docs/PRODUCTION_DEPLOYMENT.md` explicando cómo configurar `inbox_settings` en la tabla `Configuration` |
| 3.3.2 | Documentar formato JSON esperado: `{ "emailEnabled": true, "imap": { "host": "...", "port": 993, "tls": true, "user": "...", "password": "..." } }` |
| 3.3.3 | Añadir troubleshooting: "no descarga emails" → verificar puerto IMAP abierto, SSL/TLS correcto, password de aplicación (Gmail) |

**Criterio de aceptación:**
- Sección IMAP en docs con ejemplo real
- Link desde README principal

### 3.4 Limpiar archivos de debugging del backend

| # | Archivo | Acción |
|---|---|---|
| 3.4.1 | `backend/list_emps.js`, `backend/download_models.js`, `backend/fields.txt`, `backend/count.txt`, `backend/prisma_gen_log.txt` | Verificar que ya están en `.gitignore` (sí) y eliminar del working tree |
| 3.4.2 | `backend/reproduction_*.pdf`, `backend/test_script_output.pdf`, `backend/test*.pdf` | Idem |

**Criterio de aceptación:**
- `git status` no muestra estos archivos (ya ignorados)
- Working tree limpio de artefactos

### 3.5 Auditar uso de `imapflow`

| # | Pregunta | Decisión |
|---|---|---|
| 3.5.1 | ¿Se usa activamente? | Sí, `InboxService.pollEmails()` cada 5 min |
| 3.5.2 | ¿Está detrás de feature flag? | No, está activo si `inbox_settings.emailEnabled=true` |
| 3.5.3 | ¿Falla si IMAP no configurado? | Sí, pero el `try/catch` lo absorbe sin crashear |

**Criterio de aceptación:**
- Documentado: si no se quiere usar IMAP, dejar `emailEnabled=false` en BD
- README explica la diferencia entre `imap` polling y el `data/inbox/` folder watcher

---

## FASE 4: Polish (Opcional, 1 día) — Mejoras futuras

### 4.1 Convertir en PWA (service worker + manifest)

| # | Acción | Herramienta |
|---|---|---|
| 4.1.1 | Instalar `vite-plugin-pwa` | `npm i -D vite-plugin-pwa` |
| 4.1.2 | Configurar en `vite.config.ts` | Workbox + manifest |
| 4.1.3 | Estrategia de cache: NetworkFirst para `/api/`, CacheFirst para assets | Manual |
| 4.1.4 | Test offline: DevTools → Network → Offline → app carga | Manual |

**Beneficio:** Fichajes offline en zonas sin cobertura, instalable como app móvil.

### 4.2 Refactorizar `App.tsx` (crece a 225 líneas)

| # | Acción |
|---|---|
| 4.2.1 | Extraer layout (`<div className="flex h-screen...">`) a `components/Layout.tsx` |
| 4.2.2 | Extraer rutas a `routes.tsx` separado |
| 4.2.3 | Mover providers a `AppProviders.tsx` |

**Beneficio:** Mejor DX, testabilidad, y previene que el archivo crezca hasta los 500 líneas.

### 4.3 Implementar tests E2E completos

| # | Acción |
|---|---|
| 4.3.1 | Crear `e2e/` en raíz con `playwright.config.ts` |
| 4.3.2 | Migrar/cubrir los 10 flujos de la sección 2.2 |
| 4.3.3 | Integrar en CI como job separado (tras backend-tests) |

**Beneficio:** Regresiones detectadas antes de producción.

### 4.4 Documentar multi-tenancy

| # | Acción |
|---|---|
| 4.4.1 | Crear `docs/MULTI_TENANCY.md` explicando el modelo companyId |
| 4.4.2 | Listar TODAS las queries que deben filtrar por companyId |
| 4.4.3 | Referenciar la policy `shared/authz/index.ts` y middleware `companyAccess` |

**Beneficio:** Nuevos devs entienden el modelo antes de meter la pata.

### 4.5 Mejoras en Monitoring

| # | Acción |
|---|---|
| 4.5.1 | Configurar Uptime monitoring externo (UptimeRobot, BetterStack) |
| 4.5.2 | Alertas Telegram/Slack para errores 5xx recurrentes |
| 4.5.3 | Dashboard Grafana básico con métricas Redis + Postgres (opcional) |

---

## 📅 Timeline Sugerido

| Día | Horas | Fases |
|---|---|---|
| **Día 1 (mañana)** | 4h | Fase 0 (1-2h) + Fase 1 (3-4h) → **DEPLOY-BLOCKING** |
| **Día 1 (tarde)** | 4h | Inicio Fase 2: smoke test, E2E básico |
| **Día 2** | 8h | Resto de Fase 2: carga, DR, HTTPS |
| **Día 3** | 4-6h | Fase 3 (higiene) + inicio Fase 4 si hay tiempo |

**Criterio GO/NO-GO para deploy a producción:**

- [ ] Fase 0 completa (working tree limpio)
- [ ] Fase 1 completa (auth verificado, secrets rotados, integraciones validadas)
- [ ] Fase 2.1 completa (smoke test verde)
- [ ] Fase 2.2 completa (E2E 10/10 flujos)
- [ ] HTTPS activo con cert válido
- [ ] Backups verificados en S3
- [ ] Sentry capturando errores
- [ ] Al menos UN test manual de cada módulo principal (login, empleado, nómina, vacaciones, fichaje, documento)

**Si todo verde → DEPLOY. Si no, NO deployear.**

---

## 📊 Métricas de éxito post-deploy

| Métrica | Target |
|---|---|
| Uptime | ≥99.5% |
| Latencia P95 API | <500ms |
| Errores 5xx | <0.1% requests |
| Backups exitosos | 100% últimos 7 días |
| Sentry unresolved issues | <5 críticas abiertas |
| Tiempo de recuperación de backup | <30 min |
| Usuarios activos diarios | Según target del cliente |

---

## 📂 Archivos a modificar/crear (resumen)

```
.gitignore                                       [MODIFICAR] añadir *.bak, *CREDENTIALS*.md, *PRIVADO*.md
plans/2026-06-02-post-audit-fixes.md            [NUEVO] este archivo
e2e/                                             [NUEVO] opcional, tests Playwright
e2e/playwright.config.ts                         [NUEVO]
e2e/auth.spec.ts                                 [NUEVO]
e2e/employee.spec.ts                             [NUEVO]
e2e/payroll.spec.ts                              [NUEVO]
e2e/vacations.spec.ts                            [NUEVO]
e2e/kiosk.spec.ts                                [NUEVO]
docs/PRODUCTION_DEPLOYMENT.md                    [MODIFICAR] sección IMAP
docs/MULTI_TENANCY.md                            [NUEVO] opcional
backend/src/services/QueueService.ts             [MODIFICAR] quitar ocr-queue
backend/src/services/HealthChecker.ts            [MODIFICAR] quitar ocr-queue check
backend/src/services/SchedulerService.ts         [MODIFICAR] opcional: usar node-cron
frontend/src/App.tsx                             [REFACTOR] extraer Layout y routes
frontend/vite.config.ts                          [MODIFICAR] añadir vite-plugin-pwa (opcional)
```

**Archivos eliminados del repo:**
- `frontend/src/pages/Reports.tsx.bak`
- `backend/test_output*.txt`, `backend/test_write.txt`, `backend/test_final.txt`
- `backend/test*.pdf`, `backend/output.pdf`
- `DOCKER_DEPLOYMENT_CREDENTIALS.md` (movido a vault)
- `DEPLOY_HOSTINGER_PRIVADO.md` (movido a vault)

---

**Última actualización:** 2026-06-02  
**Estado:** Pendiente de aprobación e implementación  
**Próximo paso:** Tras aprobación, ejecutar FASE 0 y FASE 1 antes de cualquier deploy.
