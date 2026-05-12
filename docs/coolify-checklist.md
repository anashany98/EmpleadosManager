# Coolify Production Checklist

Use this checklist before every production deployment. All secret values must be configured in Coolify, not committed to Git.

## Required Environment Variables

### Backend

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://<user>:<password>@<postgres-host>:5432/<database>?schema=public
POSTGRES_PASSWORD=<postgres-password>
JWT_SECRET=<64-plus-character-random-secret>
ENCRYPTION_KEY=<32-byte-random-key>
KIOSK_DEVICE_SECRET=<64-plus-character-random-secret>
RETURN_TOKENS=false
CORS_ORIGIN=https://<production-domain>
FRONTEND_URL=https://<production-domain>
COOKIE_SECURE=true
COOKIE_DOMAIN=<optional-cookie-domain>
COOKIE_SAMESITE=strict
REDIS_URL=redis://default:<redis-password>@<redis-host>:6379/0
REDIS_PASSWORD=<redis-password>
STORAGE_PROVIDER=s3
S3_ENDPOINT=<s3-endpoint>
S3_REGION=<s3-region>
S3_BUCKET=<s3-bucket>
S3_ACCESS_KEY_ID=<s3-access-key-id>
S3_SECRET_ACCESS_KEY=<s3-secret-access-key>
BACKUP_UPLOAD=true
BACKUP_ENCRYPTION_KEY=<32-byte-random-key>
```

### Frontend

For same-origin deployment behind Nginx, keep `VITE_API_URL` empty. For split frontend/API domains, set it explicitly.

```env
VITE_API_URL=
PUBLIC_API_URL=https://<production-domain>
```

## Pre-Deploy

- [ ] All secrets rotated after sanitizing repository documents.
- [ ] `NODE_ENV=production`.
- [ ] `COOKIE_SECURE=true`.
- [ ] `RETURN_TOKENS=false`.
- [ ] `BACKUP_ENCRYPTION_KEY` is non-empty.
- [ ] `docker compose config` renders required variables and fails if any critical secret is missing.
- [ ] `npm run db:status` is clean in staging.
- [ ] Backend build, lint, tests, and high audit pass.
- [ ] Frontend typecheck, build, lint, and tests pass.
- [ ] Production database backup exists before running migrations.

## Deploy Order

1. PostgreSQL.
2. Redis.
3. Backend.
4. Frontend/Nginx.
5. Backup worker or scheduled backup service.

## Smoke Tests

- [ ] `GET /` returns the frontend.
- [ ] `GET /api/health` returns OK.
- [ ] `GET /api/health/liveness` returns OK without DB/Redis dependency failures.
- [ ] `GET /api/health/readiness` validates DB, Redis, and queues.
- [ ] Admin login succeeds over HTTPS.
- [ ] Employee list loads.
- [ ] Employee create/edit flow works.
- [ ] Documents upload/download works.
- [ ] Vacation request flow works.
- [ ] Reports page loads.

## Do Not Deploy If

- [ ] Any backend or frontend test is failing.
- [ ] `prisma migrate status` is not clean in staging.
- [ ] `NODE_ENV` renders as `development`.
- [ ] `COOKIE_SECURE` renders as `false`.
- [ ] Backend `npm audit --omit=dev --audit-level=high` reports HIGH or CRITICAL issues.
- [ ] Any real secret, cookie, login response, or TLS private key is tracked by Git.
