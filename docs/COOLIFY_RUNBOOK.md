# Coolify Deployment Runbook — RRHH (EmpleadosManager)

**Audience**: Operator performing the first production deploy and subsequent updates on Coolify self-hosted.

**Target**: 4-6 concurrent users, single Coolify instance, single server.

---

## 0. Pre-flight checklist (run before EVERY deploy)

```bash
# From the repo root
node --version                  # must be 22
npm run db:status               # migrations must be clean
cd backend && npm run build && npm run lint
cd backend && npm test -- --run
cd ../frontend && npx tsc --noEmit
cd ../frontend && npm run build && npm run lint
cd ../frontend && npm test -- --run
cd ../backend && npm audit --omit=dev --audit-level=high
cd .. && docker compose config  # renders compose with all env
```

**Stop and do not deploy if any of these are true**:
- `node --version` is not 22.x
- `npm run db:status` shows pending migrations
- `npm test` has failures
- `npm audit` reports HIGH or CRITICAL vulnerabilities
- `docker compose config` shows `NODE_ENV` other than `production`
- `COOKIE_SECURE` is `false`
- `RETURN_TOKENS` is anything other than `false`
- Real secrets are tracked in git

---

## 1. Required environment variables

Configure ALL of these in Coolify's UI for the application (NEVER in `.env`):

| Variable | Example | Notes |
|---|---|---|
| `NODE_ENV` | `production` | required |
| `JWT_SECRET` | `<openssl rand -base64 64>` | 64+ chars, NEVER reuse |
| `ENCRYPTION_KEY` | `<openssl rand -base64 24 \| base32 \| head -c 32>` | exactly 32 bytes |
| `BACKUP_ENCRYPTION_KEY` | `<openssl rand -base64 32>` | 32 bytes for backup encryption |
| `KIOSK_DEVICE_SECRET` | `<openssl rand -hex 32>` | only if using kiosks |
| `POSTGRES_USER` | `rrhh` | |
| `POSTGRES_PASSWORD` | `<openssl rand -base64 32>` | |
| `POSTGRES_DB` | `rrhh` | |
| `POSTGRES_PORT` | `5432` | |
| `REDIS_PASSWORD` | `<openssl rand -base64 32>` | |
| `REDIS_PORT` | `6379` | |
| `CORS_ORIGIN` | `https://rrhh.example.com` | exact frontend URL, https |
| `FRONTEND_URL` | `https://rrhh.example.com` | |
| `COOKIE_SECURE` | `true` | must be true in prod |
| `COOKIE_DOMAIN` | `.example.com` | leading dot for subdomains, or empty |
| `COOKIE_SAMESITE` | `strict` | |
| `VITE_API_URL` | `https://rrhh.example.com/api` | built into frontend |
| `S3_ENDPOINT` | `https://s3.amazonaws.com` | optional, for S3 storage |
| `S3_BUCKET` | `rrhh-prod` | |
| `S3_ACCESS_KEY_ID` | `<IAM key>` | |
| `S3_SECRET_ACCESS_KEY` | `<IAM secret>` | |
| `SENTRY_DSN` | `https://...@sentry.io/...` | optional but recommended |
| `SENTRY_RELEASE` | `1.0.0` | match git tag |
| `SENTRY_ENVIRONMENT` | `production` | |
| `OCR_POOL_SIZE` | `2` | 1-2 to keep memory bounded |
| `OCR_TIMEOUT_MS` | `60000` | 60s per file |
| `BACKUP_SCHEDULE` | `0 2 * * *` | daily at 02:00 |
| `BACKUP_RETENTION_DAYS` | `30` | |
| `BACKUP_S3_ENABLED` | `true` | recommended for off-site |
| `AWS_ACCESS_KEY_ID` | `<backup IAM>` | if BACKUP_S3_ENABLED |
| `AWS_SECRET_ACCESS_KEY` | `<backup IAM>` | |
| `AWS_REGION` | `eu-west-1` | |
| `BACKUP_S3_BUCKET` | `rrhh-prod-backups` | |
| `ONEDRIVE_REMOTE` | `onedrive` | only if using OneDrive sidecar |
| `ONEDRIVE_PATH` | `rrhh-backups` | |

**Coolify-specific**: mark `JWT_SECRET`, `ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_KEY`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `S3_SECRET_ACCESS_KEY`, `AWS_SECRET_ACCESS_KEY` as **secret** (Coolify encrypts at rest).

---

## 2. First deploy

1. **Create a "Docker Compose" project in Coolify** pointing at this repo's `docker-compose.yml`.
2. **Configure the `coolify` external network** BEFORE first deploy (only once per server):
   ```bash
   docker network create coolify
   ```
3. **Set all environment variables** from section 1 in Coolify's UI.
4. **Domain**: assign `https://rrhh.example.com` to the `nginx-proxy` service.
5. **Health check path**: `https://rrhh.example.com/api/health/liveness`.
6. **Build & Deploy**. Coolify will:
   - Build backend image (multi-stage, ~600MB final)
   - Build frontend image (Nginx, ~30MB)
   - Pull postgres:15 and redis:7
   - Wait for healthchecks
   - Start all services in dependency order
7. **Apply database migrations**:
   - Open a terminal on the backend container in Coolify UI
   - `npx prisma migrate deploy --schema=/app/database/prisma/schema.prisma`
   - Verify: `npx prisma migrate status`
8. **Seed the initial admin**:
   - `npm run seed:admin` (uses `seed-admin.ts` to create a default admin)
   - **Note**: the seed script's bcrypt hash may be known. Change the password on first login or skip seed and create the admin via API.
9. **Smoke test** (see section 4).

---

## 3. Update deploy

1. **Run the pre-flight checklist** (section 0).
2. **Apply new migrations in staging FIRST**:
   ```bash
   # Connect to staging
   ssh staging "cd /opt/rrhh && docker compose exec backend npx prisma migrate deploy"
   ```
3. **Verify staging smoke tests pass**.
4. **Push to `main`** — Coolify auto-deploys to production if webhook configured.
5. **In Coolify**: trigger redeploy (or wait for webhook).
6. **Watch logs** for 5 minutes:
   - `docker compose logs -f backend`
   - `docker compose logs -f nginx-proxy`
7. **Run smoke tests** (section 4).

---

## 4. Smoke tests (post-deploy)

```bash
# Health
curl -fsS https://rrhh.example.com/api/health/liveness  # 200
curl -fsS https://rrhh.example.com/api/health/readiness # 200 (DB+Redis+queues OK)
curl -fsS https://rrhh.example.com/api/health           # 200

# Auth
curl -fsS -X POST https://rrhh.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin@example.com","password":"<STRONG>"}' \
  -c cookies.txt  # stores access_token + csrf_token cookies

# Authenticated endpoint (uses cookie + CSRF)
curl -fsS https://rrhh.example.com/api/auth/me -b cookies.txt

# Mutating endpoint (requires CSRF header)
curl -fsS https://rrhh.example.com/api/employees \
  -b cookies.txt \
  -H "X-CSRF-Token: $(grep csrf_token cookies.txt | awk '{print $7}')"
```

Pass criteria:
- All 4 health endpoints return 200
- Login sets `access_token` (HttpOnly) and `csrf_token` cookies
- `/api/auth/me` returns 200 with the user object
- A POST with the correct CSRF header returns 2xx

---

## 5. Rollback (if smoke tests fail)

1. **In Coolify**: stop the deployment, redeploy the previous image tag:
   ```bash
   docker compose pull backend frontend
   docker compose up -d
   ```
2. **If database migration broke things**: see `docs/ROLLBACK_PLAN.md`.
3. **If only nginx config broke**: restart just the proxy:
   ```bash
   docker compose restart nginx-proxy
   ```
4. **Notify users** via email / Slack.

---

## 6. Monitoring & alerting

### Health probes (Coolify)

- **Liveness**: `GET /api/health/liveness` → 200
- **Readiness**: `GET /api/health/readiness` → 200 (DB+Redis+queues)
- **Comprehensive**: `GET /api/health` → 200 (full status)

### External uptime monitoring (recommended)

Configure one of:
- **UptimeRobot** (free): ping `/api/health/liveness` every 5 minutes
- **BetterStack**: same path, with email/SMS alerts
- **Coolify's own health checks**: built-in

### Sentry

Verify in Sentry UI that errors from the new release are arriving:
- Project → Issues → check release matches `SENTRY_RELEASE`
- Configure alert: "More than 10 errors in 5 minutes" → email/Slack

### Backups

Daily backup at 02:00 server time. Verify:
- Local: `docker compose exec backup ls /backups` (should show recent `.sql.gz` files)
- S3 (if enabled): check `BACKUP_S3_BUCKET` for files with today's date
- OneDrive (if enabled): check the `rrhh-backups` folder
- **Weekly**: run `scripts/test-restore-backup.sh` to a scratch DB and verify

### Resource alerts

Watch in Coolify's metrics:
- Backend memory > 80% sustained (1.5GB limit)
- Postgres connections > 80% of `max_connections` (default 100)
- Redis memory > 80% of 512MB

---

## 7. Disaster recovery

See `docs/disaster-recovery.md`. TL;DR:

- **RPO**: 24 hours (daily backup at 02:00)
- **RTO**: 4 hours (redeploy + restore)
- **Verify backups weekly** with `scripts/verify-backups.sh`
- **Test restore monthly** with `scripts/test-restore-backup.sh`

---

## 8. Common issues (Quick reference)

| Symptom | Cause | Fix |
|---|---|---|
| `EADDRINUSE` on backend start | Port 3000 in use | Restart the backend container |
| `JWT_SECRET must be defined` | env not set in Coolify | Re-add in UI, redeploy |
| `CORS error` in browser | `CORS_ORIGIN` mismatch with frontend URL | Update env, redeploy |
| Login returns 200 but no cookies | `COOKIE_SECURE=true` but HTTP, or `SAMESITE` issue | Use HTTPS; check `SAMESITE=strict` |
| 401 after refresh | `COOKIE_DOMAIN` mismatch | Set to leading-dot domain |
| `Database connection refused` | Postgres not ready | Check `docker compose ps postgres`; restart backend |
| `OCR container OOM` | Image too large | Reduce `OCR_POOL_SIZE=1`, increase backend memory to 2GB |
| Backups not running | Wrong `BACKUP_SCHEDULE` or backup container down | Check `docker compose logs backup` |
| Migration error on first deploy | Schema drift | Re-run `npx prisma migrate deploy`; see `docs/ROLLBACK_PLAN.md` |

---

## 9. Security checklist (post-deploy)

- [ ] `RETURN_TOKENS=false` in backend env (audit: `curl https://rrhh.example.com/api/auth/login` response should NOT contain `token` field)
- [ ] `COOKIE_SECURE=true` (audit: response cookies should have `Secure` flag)
- [ ] HTTPS works (no mixed-content warnings in browser console)
- [ ] HSTS header present: `curl -I https://rrhh.example.com | grep -i strict-transport`
- [ ] No 5xx errors in Sentry for 30 minutes post-deploy
- [ ] All Coolify env vars marked as "secret" except non-sensitive ones
- [ ] `docker compose exec backend env | grep -E '(PASSWORD|SECRET|KEY)' | grep -v REDACTED` shows no plain secrets in env (Coolify hides them, but verify)
- [ ] CSP header present in response headers from nginx

---

**Last updated**: 2026-06-15  
**Version**: 1.0.0
