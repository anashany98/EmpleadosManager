# Docker Deployment Credentials

> Sanitized on 2026-05-11. This repository must not store real passwords, tokens, private keys, cookies, API keys, or host credentials.

## Status

Any credential that appeared in previous versions of this document must be treated as compromised and rotated before production deployment.

## Required Production Secrets

Store these only in the deployment platform secret manager, for example Coolify environment variables:

```env
POSTGRES_PASSWORD=<rotate-before-deploy>
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>?schema=public
JWT_SECRET=<64-plus-character-random-secret>
ENCRYPTION_KEY=<32-byte-random-key>
KIOSK_DEVICE_SECRET=<64-plus-character-random-secret>
REDIS_PASSWORD=<rotate-before-deploy>
REDIS_URL=redis://default:<password>@<host>:6379/0
BACKUP_ENCRYPTION_KEY=<32-byte-random-key>
S3_ACCESS_KEY_ID=<object-storage-access-key>
S3_SECRET_ACCESS_KEY=<object-storage-secret-key>
```

## Rotation Checklist

- [ ] Rotate host panel password and SSH keys if they were copied into this repo.
- [ ] Rotate PostgreSQL password and update `DATABASE_URL`.
- [ ] Rotate Redis password and update `REDIS_URL`.
- [ ] Rotate `JWT_SECRET`, `ENCRYPTION_KEY`, `KIOSK_DEVICE_SECRET`, and `BACKUP_ENCRYPTION_KEY`.
- [ ] Rotate object storage credentials if configured.
- [ ] Recreate production cookies/sessions after rotating JWT secrets.
- [ ] Verify `git ls-files .env cookies.txt login_response.json nginx/ssl/*.pem` does not return tracked secrets.

## Operating Rule

Production secrets live in Coolify/Hostinger secret storage only. Documentation in this repository uses placeholders.
