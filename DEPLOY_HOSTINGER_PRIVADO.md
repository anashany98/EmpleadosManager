# Hostinger Private Deployment Notes

> Sanitized on 2026-05-11. This file intentionally contains placeholders only.

## Connection Placeholders

```text
HOSTINGER_PANEL_URL=<hostinger-panel-url>
HOSTINGER_PROJECT=<project-name>
SERVER_HOST=<server-hostname-or-ip>
SERVER_USER=<ssh-user>
SERVER_SSH_PORT=<ssh-port>
COOLIFY_URL=<coolify-url>
PRODUCTION_DOMAIN=<https://app.example.com>
API_DOMAIN=<https://api.example.com>
```

Do not commit:

- Hostinger passwords.
- SSH private keys.
- Coolify tokens.
- Database passwords.
- Redis passwords.
- JWT or encryption secrets.
- Cookies or login responses.
- TLS private keys.

## Production Deployment Flow

1. Rotate every credential that was previously documented in this repository.
2. Store production secrets in Coolify environment variables.
3. Confirm `docker compose config` renders production values without empty critical secrets.
4. Run Prisma migrations in staging before production.
5. Run the production smoke checklist from `docs/coolify-checklist.md`.
6. Deploy only when tests, lint, audit, migrations, and health checks are green.

## Emergency Access

Use the password manager or Hostinger/Coolify secret manager as the source of truth. If access details are missing, request them through the operational owner instead of recreating them in Git.
