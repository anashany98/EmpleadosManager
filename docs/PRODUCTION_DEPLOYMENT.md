# 🚀 Production Deployment Guide
## EmpleadosManager - HR & Payroll System

This guide covers deployment to production environments with 4-6 concurrent users.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Docker Deployment](#docker-deployment)
4. [Coolify Deployment](#coolify-deployment)
5. [Database Setup](#database-setup)
6. [Initial Setup](#initial-setup)
7. [Monitoring & Alerts](#monitoring--alerts)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance](#maintenance)
10. [Security Checklist](#security-checklist)

---

## Prerequisites

### Required Infrastructure

- **PostgreSQL 15+** database (recommended: managed RDS or Cloud SQL)
- **Redis 7+** for caching and job queues (managed Redis recommended)
- **Docker & Docker Compose** installed on the server (if self-hosting)
- **SSL/TLS certificates** (HTTPS required in production)
- **S3-compatible storage** (AWS S3, MinIO, or other) for file uploads
- **SMTP server** for email notifications (optional but recommended)

### Domain & Network

- A registered domain (e.g., `hr.yourcompany.com`)
- DNS A record pointing to your server IP
- Ports 80 and 443 open (HTTP/HTTPS)
- Outbound SMTP allowed (port 587/465) if using email

### Server Specifications (for 4-6 users)

**Minimum**:
- 2 vCPUs
- 4 GB RAM
- 50 GB SSD storage
- Ubuntu 22.04 LTS or similar

**Recommended**:
- 4 vCPUs
- 8 GB RAM
- 100 GB SSD storage
- Ubuntu 24.04 LTS

---

## Environment Configuration

### 1. Clone and Build

```bash
git clone <your-repo-url>
cd EmpleadosManager
```

### 2. Copy Production Environment File

```bash
cp backend/.env.example backend/.env
```

### 3. Edit `backend/.env` with Production Values

**CRITICAL SECURITY SETTINGS** (⚠️ Do NOT skip):

```bash
# Server
NODE_ENV=production
PORT=3000

# Database (use connection pooling)
DATABASE_URL="postgresql://user:password@db-host:5432/nominas_db?connection_limit=20"

# JWT Secret - Generate with: openssl rand -base64 32
JWT_SECRET="your-actual-32+-char-secret-here"

# Encryption Key - MUST be exactly 32 characters
ENCRYPTION_KEY="your-32-char-aes-key-here-012345678"

# Kiosk Secret (for physical timeclock devices)
KIOSK_DEVICE_SECRET="random-secret-for-kiosks"

# Bcrypt rounds (10-12 recommended)
BCRYPT_ROUNDS=11
```

**CORS & Cookies** (configure for your domain):

```bash
CORS_ORIGIN="https://hr.yourcompany.com"
FRONTEND_URL="https://hr.yourcompany.com"
COOKIE_SECURE="true"          # HTTPS only
COOKIE_DOMAIN=".yourcompany.com"  # Leading dot for subdomains
COOKIE_SAMESITE="lax"
```

**S3 Storage** (required for file uploads):

```bash
STORAGE_PROVIDER="s3"
S3_ENDPOINT="https://s3.amazonaws.com"  # Or your provider's endpoint
S3_REGION="us-east-1"
S3_BUCKET="your-company-nominas"
S3_ACCESS_KEY_ID="your-access-key"
S3_SECRET_ACCESS_KEY="your-secret-key"
S3_PUBLIC_URL="https://cdn.yourcompany.com/nominas"  # Optional
```

**Redis**:

```bash
REDIS_URL="redis://:password@redis-host:6379"
REDIS_NAMESPACE="nominas:"
```

**Sentry (Recommended for error monitoring)**:

1. Create account at https://sentry.io
2. Create new project (Node.js/Express)
3. Get DSN

```bash
SENTRY_DSN="https://your-key@your-region.ingest.sentry.io/your-project"
SENTRY_RELEASE="1.0.0"  # Or git SHA: $GIT_COMMIT
SENTRY_ENVIRONMENT="production"
SENTRY_TRACES_SAMPLE_RATE="0.1"  # Adjust based on traffic
```

**Email (SMTP)** - Optional but recommended:

```bash
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="hr@yourcompany.com"
SMTP_PASSWORD="your-app-password"
EMAIL_FROM="noreply@yourcompany.com"
EMAIL_REPLY_TO="hr@yourcompany.com"
```

**Logging**:

```bash
LOG_LEVEL="warn"  # Less verbose in production: error | warn | info
LOG_FORMAT="json" # Structured logging for log aggregation
```

**Alerting** (where to send critical alerts):

```bash
ALERT_EMAIL="admin@yourcompany.com"
ALERT_WEBHOOK_URL=""  # Optional: Slack/Teams webhook
```

**Feature Flags**:

```bash
ENABLE_REGISTRATION="false"      # Disable self-registration in production
ENABLE_OCR="true"                # Enable OCR for document processing
ENABLE_AUDIT_TRAIL="true"        # Log all data changes (recommended)
RETURN_TOKENS="false"            # ⚠️ NEVER enable in production (security risk)
ENABLE_SWAGGER="false"           # Disable API docs in production
```

### 4. Validate Configuration

```bash
cd backend
npm run build
npx ts-node src/app/configValidator.ts
```

---

## Docker Deployment

### Option A: Docker Compose (Recommended)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-nominas}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: nominas_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - rrhh-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-nominas}"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - rrhh-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "ping"]
      interval: 30s
      timeout: 5s
      retries: 3

  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    restart: always
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${POSTGRES_USER:-nominas}:${POSTGRES_PASSWORD}@postgres:5432/nominas_db
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      # Pass all other env vars from .env file
      # Use env_file or pass individually
    env_file:
      - backend/.env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - rrhh-network
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health', r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
      args:
        VITE_API_URL: https://hr.yourcompany.com/api
    restart: always
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    networks:
      - rrhh-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 5s
      retries: 3

  # Optional: Nginx Proxy for SSL termination
  nginx-proxy:
    image: nginx:alpine
    restart: always
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro  # SSL certificates
    depends_on:
      - frontend
      - backend
    networks:
      - rrhh-network

volumes:
  postgres_data:
  redis_data:

networks:
  rrhh-network:
    driver: bridge
```

**Deploy with Docker Compose**:

```bash
# Create .env file with all variables (see above)
docker-compose up -d

# Check logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Check health
docker-compose ps
```

### Option B: Coolify Deployment

Coolify provides managed deployment with automatic HTTPS, backups, and monitoring.

**Steps**:

1. In Coolify, create a new **Application** → **Docker Compose**
2. Upload your `docker-compose.yml` or use the template above
3. Configure environment variables in Coolify's UI (safer than .env files)
4. Set up **Health Checks**:
   - Backend: `http://localhost:3000/api/health/liveness`
   - Frontend: `http://localhost/`
5. Enable **Automatic Deployments** from your Git repository
6. Configure **SSL** (Coolify can auto-provision Let's Encrypt)
7. Set up **Backups** (database + file storage)

**Coolify-Specific Settings**:

- **Instance Type**: Choose based on specs above
- **Deployment Type**: Docker Compose
- **Health Check Interval**: 30s
- **Restart Policy**: Always
- **HTTP/2**: Enabled
- **Gzip Compression**: Enabled

---

## Database Setup

### Apply Prisma Migrations

```bash
# Enter backend container
docker-compose exec backend sh

# Run migrations
npx prisma migrate deploy

# Optional: seed initial data (admin user)
npm run seed:admin

# Exit container
exit
```

### Verify Database Connection

```bash
docker-compose exec backend node -e "require('./dist/src/lib/prisma').prisma.\$connect().then(() => console.log('DB OK')).catch(e => console.error(e))"
```

---

## Initial Setup

### 1. Create Admin User

```bash
# Via seed script (if configured)
docker-compose exec backend npm run seed:admin

# OR manually via API:
curl -X POST https://hr.yourcompany.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourcompany.com",
    "password": "YourStrongPassword123!",
    "name": "Admin User",
    "role": "admin"
  }'
```

### 2. Configure Companies & Departments

Via the UI or API, set up:
- Your company(ies)
- Departments (Engineering, HR, Sales, etc.)
- Positions with associated salary bands
- Holiday calendars

### 3. Configure Email Templates

If using email notifications, customize templates in:
- `backend/src/templates/` (PDF templates)
- Email content in database (config table)

### 4. Configure Backup Strategy

**Database backups** (automated):
```bash
# Add to crontab on host or separate backup container
0 2 * * * docker-compose exec -T postgres pg_dump -U nominas nominas_db > /backups/nominas_$(date +\%Y\%m\%d).sql
```

**File storage backups** (S3 usually handles this):
Enable versioning on your S3 bucket.

---

## Monitoring & Alerts

### Health Endpoints

- **Liveness**: `GET /api/health/liveness` - Returns 200 if app is running
- **Readiness**: `GET /api/health/readiness` - Returns 200 if ready to serve traffic
- **Comprehensive**: `GET /api/health` - Full status with all dependencies

**Example**:
```bash
curl https://hr.yourcompany.com/api/health
# Response:
{
  "status": "healthy",
  "timestamp": "2026-04-16T10:00:00.000Z",
  "uptime": 86400,
  "checks": {
    "database": { "status": "healthy", "responseTime": 5.2 },
    "redis": { "status": "healthy", "responseTime": 1.1 },
    "disk": { "status": "healthy", "freeGB": 45.2 }
  }
}
```

### Sentry Error Tracking

- Log into Sentry dashboard
- Set up alerts for:
  - New error types
  - Spike in error volume
  - Performance degradation
- Configure issue assignments to your team

### Log Aggregation (Optional)

Forward logs to a central system (ELK, Loki, Datadog):

```yaml
# In docker-compose, add logging driver
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

Or use a sidecar:
```bash
docker-compose logs -f backend | tee -a /var/log/rrhh/backend.log
```

---

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

**Symptom**: `Error: listen EADDRINUSE: address already in use 0.0.0.0:3000`

**Solution**:
```bash
# Find process using port 3000
netstat -ano | findstr :3000  # Windows
# or
lsof -i :3000  # Linux/Mac

# Kill it (replace PID)
taskkill /F /PID <PID>

# Or change PORT in .env to use different port
```

#### 2. Database Connection Errors

**Symptom**: `Failed to connect to database`

**Check**:
- DATABASE_URL is correct and accessible from container
- PostgreSQL is running and accepting connections
- Firewall allows port 5432
- Credentials are correct

```bash
# Test connection from backend container
docker-compose exec backend ping postgres
docker-compose exec backend nc -zv postgres 5432
```

#### 3. Redis Connection Failures

**Symptom**: `Redis connection error`

**Fix**:
- Verify REDIS_URL or REDIS_HOST/PORT
- Check Redis password if set
- Ensure Redis is running: `docker-compose ps redis`

#### 4. 403 Forbidden on CORS

**Symptom**: Frontend requests blocked by CORS

**Solution**:
- Set `CORS_ORIGIN` to your exact frontend URL (https)
- Include both http and https if needed: `http://localhost:5173,https://hr.yourcompany.com`
- Clear browser cache or test in incognito

#### 5. File Upload Failures (S3)

**Symptom**: Uploads fail with S3 errors

**Checklist**:
- S3 credentials correct
- Bucket exists and has write permissions
- `S3_ENDPOINT` correct (for MinIO: `http://minio:9000`)
- Bucket policy allows public read if `S3_PUBLIC_URL` is set

#### 6. Health Checks Failing in Coolify

**Symptom**: Instance marked as "unhealthy"

**Fix**:
- Ensure health endpoint returns 200 within timeout (5s)
- Check that server binds to `0.0.0.0` (not 127.0.0.1)
- Verify firewall allows health check IPs
- Increase `start-period` in Dockerfile HEALTHCHECK

#### 7. Memory Issues (Canvas/PDF Generation)

**Symptom**: Process killed with OOM

**Solution**:
- Increase container memory limit to at least 2GB
- Tune `NODE_OPTIONS="--max-old-space-size=2048"`
- Consider offloading PDF generation to a separate worker queue

#### 8. Email Not Sending

**Symptom**: SMTP errors in logs

**Fix**:
- Verify SMTP credentials
- Check if provider requires app-specific passwords (Gmail)
- Ensure outbound port 587/465 is not blocked
- Set `EMAIL_FROM` to verified domain

#### 9. Timezone Issues

Payroll calculations depend on correct timezone.

```bash
# Set timezone in Dockerfile or container
ENV TZ=Europe/Madrid
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime
```

#### 10. Slow Queries

Enable Prisma query logging:

```bash
# In .env
LOG_LEVEL="http"  # Logs all queries

# Use Prisma Studio to inspect
npx prisma studio
```

Consider adding database indexes:

```prisma
model Employee {
  // ...
  @@index([email])
  @@index([companyId])
  @@index([dni])
}
```

---

## Maintenance

### Updating the Application

1. Pull latest code
2. Rebuild and restart:

```bash
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

3. Run any new migrations:

```bash
docker-compose exec backend npx prisma migrate deploy
```

### Database Backups

**Automated daily backups** (add to crontab):

```bash
0 2 * * * docker-compose exec -T postgres pg_dump -U nominas nominas_db | gzip > /backups/nominas_$(date +\%Y\%m\%d).sql.gz
```

**Restore from backup**:

```bash
gunzip -c backup.sql.gz | docker-compose exec -T postgres psql -U nominas nominas_db
```

### Log Rotation

```bash
# Rotate logs weekly
docker-compose logs --since="7 days" > /var/log/rrhh/weekly-$(date +\%Y\%m\%d).log
docker-compose logs --since="7 days" --no-log-prefix > /dev/null
```

### Monitoring Uptime

Use external monitoring (UptimeRobot, Pingdom) to ping:
- `https://hr.yourcompany.com/api/health/liveness`
- `https://hr.yourcompany.com/`

---

## Security Checklist

### Pre-Launch Security Verification

- [ ] Change all default passwords and secrets
- [ ] Use strong JWT_SECRET (32+ cryptographically random chars)
- [ ] ENCRYPTION_KEY is 32 chars and stored securely
- [ ] `RETURN_TOKENS=false` in production .env
- [ ] `ENABLE_REGISTRATION=false` (unless self-service required)
- [ ] `ENABLE_SWAGGER=false` (API docs disabled)
- [ ] HTTPS enforced (redirect HTTP → HTTPS)
- [ ] HSTS header enabled (1 year max-age)
- [ ] CSRF protection active
- [ ] Rate limiting configured for all endpoints
- [ ] Redis password set
- [ ] Database user has minimal privileges (SELECT, INSERT, UPDATE, DELETE only)
- [ ] Docker containers run as non-root users
- [ ] S3 bucket not publicly accessible (private)
- [ ] Regular backups scheduled and tested
- [ ] Sentry DSN configured for error monitoring
- [ ] Admin email configured for alerts
- [ ] Docker images from trusted sources only
- [ ] `npm audit` shows no critical/high vulnerabilities
- [ ] Trivy security scan passed (from CI/CD)

### Post-Deployment

- [ ] Monitor Sentry for first 24h errors
- [ ] Review access logs for unauthorized attempts
- [ ] Verify backups are running
- [ ] Test disaster recovery (restore from backup)
- [ ] Review cost metrics (cloud resources)
- [ ] Set up quarterly security review

---

## Support

For issues not covered here:
- Check logs: `docker-compose logs -f backend`
- Review GitHub Issues
- Contact: devops@yourcompany.com

---

**Last Updated**: April 2026  
**Version**: 1.0.0