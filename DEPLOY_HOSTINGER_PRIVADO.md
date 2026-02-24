# Deploy privado en Hostinger + Coolify (ya montado)

Este manual asume:
- Ya tienes VPS en Hostinger.
- Ya tienes Coolify funcionando.
- Quieres la app solo para tu equipo (sin exponerla publica).

## 1) Hardening obligatorio antes de desplegar

No uses secretos fallback en codigo.

En `backend/src/services/AuthService.ts`:

```ts
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('FATAL: JWT_SECRET must be defined.');
```

En `backend/src/controllers/CalendarController.ts`:

```ts
const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error('FATAL: JWT_SECRET must be defined.');
```

## 2) Ajustar `docker-compose.yml` para privado

En `docker-compose.yml` deja asi:

- `postgres`: sin `ports`.
- `redis`: sin `ports`.
- `backend.ports`: `127.0.0.1:16161:3000`
- `frontend.ports`: `127.0.0.1:17171:80`
- `backend.environment`: anadir `RETURN_TOKENS=${RETURN_TOKENS:-false}`

Con esto, ni API ni DB quedan publicas directamente.

## 3) Crear recurso en Coolify (Docker Compose)

1. En Coolify crea un recurso tipo `Docker Compose`.
2. Conecta tu repo y rama.
3. Compose file: `docker-compose.yml` (raiz).
4. No asignes dominio publico por ahora.
5. Despliega.

Nota: Este repo usa red externa `coolify`; en Hostinger+Coolify suele existir ya. Si no existe:

```bash
docker network create coolify
```

## 4) Variables de entorno en Coolify

Define estas variables en Coolify (Environment Variables):

```env
POSTGRES_USER=rrhh
POSTGRES_PASSWORD=CAMBIA_ESTA_PASS_DB
POSTGRES_DB=rrhh
DATABASE_URL=postgresql://rrhh:CAMBIA_ESTA_PASS_DB@postgres:5432/rrhh?schema=public

JWT_SECRET=SECRETO_LARGO_ALEATORIO
ENCRYPTION_KEY=CLAVE_DE_32_CARACTERES

CORS_ORIGIN=https://APP_PRIVADA_TSNET
FRONTEND_URL=https://APP_PRIVADA_TSNET
VITE_API_URL=/api

COOKIE_SECURE=true
COOKIE_DOMAIN=
COOKIE_SAMESITE=lax
CSRF_COOKIE_NAME=csrf_token
CSRF_HEADER_NAME=x-csrf-token
CSRF_MAX_AGE_MS=604800000

STORAGE_PROVIDER=local
BACKUP_UPLOAD=false
RETURN_TOKENS=false
```

### Modo S3 (AWS o compatible)

Si quieres guardar adjuntos en S3 en vez de disco local, usa:

```env
STORAGE_PROVIDER=s3
S3_REGION=eu-west-1
S3_BUCKET=tu-bucket
S3_ACCESS_KEY_ID=AKIA...
S3_SECRET_ACCESS_KEY=...
```

`S3_ENDPOINT`:
- AWS S3 normal: dejalo vacio.
- S3 compatible (MinIO, Wasabi, etc): pon endpoint completo, por ejemplo `https://s3.tu-proveedor.com`.

Ejemplo completo en Coolify para S3:

```env
POSTGRES_USER=rrhh
POSTGRES_PASSWORD=CAMBIA_ESTA_PASS_DB
POSTGRES_DB=rrhh
DATABASE_URL=postgresql://rrhh:CAMBIA_ESTA_PASS_DB@postgres:5432/rrhh?schema=public

JWT_SECRET=SECRETO_LARGO_ALEATORIO
ENCRYPTION_KEY=CLAVE_DE_32_CARACTERES

CORS_ORIGIN=https://APP_PRIVADA_TSNET
FRONTEND_URL=https://APP_PRIVADA_TSNET
VITE_API_URL=/api

COOKIE_SECURE=true
COOKIE_DOMAIN=
COOKIE_SAMESITE=lax
CSRF_COOKIE_NAME=csrf_token
CSRF_HEADER_NAME=x-csrf-token
CSRF_MAX_AGE_MS=604800000

STORAGE_PROVIDER=s3
S3_ENDPOINT=
S3_REGION=eu-west-1
S3_BUCKET=tu-bucket
S3_ACCESS_KEY_ID=AKIA...
S3_SECRET_ACCESS_KEY=...
BACKUP_UPLOAD=true
RETURN_TOKENS=false
```

Permisos minimos IAM del usuario S3:
- `s3:PutObject`
- `s3:GetObject`
- `s3:DeleteObject`

Politica minima de ejemplo (AWS):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::tu-bucket/*"
    }
  ]
}
```

Opcional (recomendado para descargas via `fetch` en frontend): CORS en el bucket para tu dominio/app privada.

Generar secretos en el VPS:

```bash
openssl rand -base64 48
openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 32; echo
```

## 5) Migraciones despues del deploy

Tras desplegar en Coolify, ejecuta:

```bash
docker exec -it nominas_backend npx prisma migrate deploy --schema=../database/prisma/schema.prisma
```

Verificar salud:

```bash
curl -I http://127.0.0.1:16161/api/health
```

## 6) Publicar solo a tu red con Tailscale

Instala Tailscale en el host (si no esta):

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh
```

Publica frontend privado:

```bash
sudo tailscale serve --https=443 http://127.0.0.1:17171
sudo tailscale serve status
```

URL privada:

```text
https://<hostname>.<tu-tailnet>.ts.net
```

## 7) Crear usuario admin y empleado

```bash
ADMIN_PASS=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 16)
EMP_PASS=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 16)

docker exec -i nominas_backend node - <<'EOF'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

(async () => {
  const adminEmail = 'admin@tuempresa.com';
  const empEmail = 'empleado@tuempresa.com';
  const empDni = '12345678Z';
  const adminPass = process.env.ADMIN_PASS;
  const empPass = process.env.EMP_PASS;
  const perms = {
    employees: 'write',
    payroll: 'write',
    companies: 'write',
    calendar: 'write',
    audit: 'write',
    assets: 'write',
    reports: 'write',
    timesheet: 'write',
    projects: 'write'
  };

  const emp = await prisma.employee.upsert({
    where: { dni: empDni },
    update: { name: 'Empleado Demo', email: empEmail, active: true },
    create: { dni: empDni, name: 'Empleado Demo', email: empEmail, active: true }
  });

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { password: await bcrypt.hash(adminPass, 10), role: 'admin', permissions: JSON.stringify(perms) },
    create: { email: adminEmail, password: await bcrypt.hash(adminPass, 10), role: 'admin', permissions: JSON.stringify(perms) }
  });

  await prisma.user.upsert({
    where: { email: empEmail },
    update: {
      password: await bcrypt.hash(empPass, 10),
      role: 'employee',
      dni: empDni,
      employeeId: emp.id,
      permissions: JSON.stringify({})
    },
    create: {
      email: empEmail,
      password: await bcrypt.hash(empPass, 10),
      role: 'employee',
      dni: empDni,
      employeeId: emp.id,
      permissions: JSON.stringify({})
    }
  });

  console.log('OK usuarios creados');
  await prisma.$disconnect();
})();
EOF
```

Ejecutalo exportando variables:

```bash
export ADMIN_PASS EMP_PASS
```

Credenciales finales:

```bash
echo "ADMIN: admin@tuempresa.com / $ADMIN_PASS"
echo "EMPLEADO: empleado@tuempresa.com / $EMP_PASS"
```

## 8) Smoke test con Playwright

En tu maquina local (o en el VPS):

```bash
npm ci
npm run pw:install
PW_BASE_URL="https://<hostname>.<tu-tailnet>.ts.net" PW_USER="admin@tuempresa.com" PW_PASSWORD="$ADMIN_PASS" npm run pw:smoke
```

Reporte:

```text
output/playwright/smoke-report.json
```

## 9) Operacion diaria

Redeploy:

```bash
git pull
docker compose up -d --build
docker exec -it nominas_backend npx prisma migrate deploy --schema=../database/prisma/schema.prisma
```

Logs:

```bash
docker logs -f nominas_backend
docker logs -f nominas_frontend
```

Backup DB:

```bash
docker exec -i nominas_db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup_$(date +%F_%H%M).sql
```

## Checklist GO (privado)

- [ ] Sin fallback de secretos en codigo.
- [ ] `JWT_SECRET` fuerte.
- [ ] `ENCRYPTION_KEY` de 32 chars.
- [ ] `RETURN_TOKENS=false`.
- [ ] DB/Redis sin puertos publicos.
- [ ] Frontend/API en `127.0.0.1`.
- [ ] Acceso solo por Tailscale `ts.net`.
- [ ] Login admin y empleado probado.
- [ ] Smoke report sin errores criticos.
