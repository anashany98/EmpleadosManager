# 🔧 Quick Troubleshooting Guide
## EmpleadosManager - Common Issues & Quick Fixes

---

## 🚨 Critical Startups Issues

### Issue: `EADDRINUSE: Port 3000 already in use`

**Cause**: Another node process is already bound to port 3000.

**Fix**:
```powershell
# Windows
netstat -ano | findstr :3000
taskkill /F /PID <PID>

# Linux/Mac
lsof -i :3000
kill -9 <PID>

# Or change PORT in .env to 3001, 8080, etc.
```

---

### Issue: `Database connection failed`

**Symptoms**:
- `Failed to connect to database`
- `prisma.$connect()` timeout

**Checklist**:
- ✅ `DATABASE_URL` is correct
- ✅ Database is running: `docker-compose ps postgres`
- ✅ Credentials are valid
- ✅ Network connectivity: `ping <db-host>`
- ✅ Port 5432 accessible (not blocked by firewall)
- ✅ Database exists: `createdb` or via psql

**Test quickly**:
```bash
# From host
psql "postgresql://user:pass@host:5432/dbname" -c "SELECT 1"

# From container
docker-compose exec backend ping postgres
docker-compose exec backend nc -zv postgres 5432
```

---

### Issue: `Redis connection error`

**Symptoms**:
- `ECONNREFUSED` or `ETIMEDOUT` from Redis

**Fix**:
```bash
# Check Redis is running
docker-compose ps redis
docker-compose logs redis

# Test connection
docker-compose exec backend redis-cli -h redis -a password ping
# Should return PONG

# Verify REDIS_URL or REDIS_HOST/PORT in .env
```

---

## 📊 Health Check Failures

### Liveness probe failing

**Endpoint**: `GET /api/health/liveness`

**Expected**: `{"status":"live"}` with 200

**If returning 500**:
- Check server logs: `docker-compose logs backend | grep -i error`
- Verify `validateRuntimeConfiguration()` passed
- Check if database is connected

### Readiness probe failing

**Endpoint**: `GET /api/health/readiness`

**Expected**: `{"status":"ready"}` with 200

**Possible causes**:
- Database not ready yet (give more `start-period` in HEALTHCHECK)
- Redis not reachable
- Disk space low
- Worker queues not started

**Debug**:
```bash
# Get comprehensive health
curl http://localhost:3000/api/health | jq .

# Check each component individually
docker-compose exec backend node -e "require('./dist/src/lib/prisma').prisma.\$connect()"
```

---

## 🔐 Authentication & Authorization Issues

### Issue: Login returns 401 but credentials are correct

**Possible causes**:
1. JWT_SECRET changed (all existing tokens invalidate)
2. User not found or inactive
3. Password hashing mismatch (check bcrypt rounds)

**Debug**:
```bash
# Check user exists in DB
docker-compose exec postgres psql -U nominas nominas_db -c "SELECT id, email, active FROM User WHERE email='user@example.com';"

# Verify JWT secret length
echo -n "your-secret" | wc -c  # Must be >= 32
```

### Issue: CSRF token missing/invalid

**Fix**:
- Frontend must include CSRF token in headers (`x-csrf-token`)
- Token obtained from cookie `csrf_token`
- Ensure `COOKIE_SAMESITE` and `COOKIE_SECURE` are consistent

---

## 📁 File Upload Problems

### S3 Uploads fail

**Check**:
```bash
# Verify S3 credentials
aws s3 ls s3://your-bucket --endpoint-url https://your-endpoint  # if using custom

# Check bucket policy - should allow write from your access key
# In AWS Console: S3 → bucket → Permissions

# Check logs for specific error
docker-compose logs backend | grep -i "s3\|upload"
```

**Common fixes**:
- `S3_ENDPOINT` must NOT have trailing slash
- `S3_PUBLIC_URL` must match actual bucket URL
- Ensure IAM user has `s3:PutObject`, `s3:GetObject` permissions

### Local uploads not persisting

**Cause**: `backend/uploads` not mapped to persistent volume

**Fix** (docker-compose):
```yaml
backend:
  volumes:
    - ./uploads:/app/backend/uploads
```

---

## 🏗️ Build & Deployment Issues

### Docker build fails on `canvas` dependency

**Cause**: Missing system libraries

**Already handled** in Dockerfile with:
```dockerfile
RUN apk add --no-cache \
    build-base \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg2-dev
```

If still failing:
- Increase Docker build memory (in Docker Desktop: Resources → Increase to 8GB+)
- Use `--no-cache` flag: `docker-compose build --no-cache backend`

### Frontend build fails with memory error

**Symptom**: `JavaScript heap out of memory`

**Fix**:
Already handled with `ENV NODE_OPTIONS="--max-old-space-size=4096"` in Dockerfile.

If still failing, increase to `8192` or build locally and copy artifacts.

---

## 📈 Performance Issues

### Slow API responses (>2s)

**Diagnose**:
```bash
# Enable query logging temporarily
# In .env: LOG_LEVEL="http"

# Check slow queries in logs
docker-compose logs backend | grep "query"

# Use Prisma Studio to inspect
docker-compose exec backend npx prisma studio
# Check for missing indexes
```

**Solutions**:
- Add database indexes: `@@index([field])`
- Increase `PRISMA_QUERY_TIMEOUT` if legitimate long queries
- Optimize N+1 queries with Prisma `.include()` or raw SQL

### High memory usage

**Check**:
```bash
docker stats  # Show container resource usage
```

**If backend > 2GB**:
- Reduce `WORKER_CONCURRENCY` (default 5)
- Check for memory leaks (long-running processes not releasing)
- Scale horizontally (run multiple backend instances behind load balancer)

---

## 🔍 Log Analysis

### Where to find logs

**Docker Compose**:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last N lines
docker-compose logs --tail=100 backend

# With timestamps
docker-compose logs -f --timestamps backend
```

**Production Server (no compose)**:
```bash
# If running as systemd service
journalctl -u rrhh-backend -f

# If running in screen/tmux
# Check the process output
```

### Useful log patterns

```bash
# Find all errors
docker-compose logs backend | grep -i error

# Find port binding errors
docker-compose logs backend | grep -i "EADDRINUSE\|EACCES"

# Find database errors
docker-compose logs backend | grep -i "database\|prisma\|connection"

# Health check status
docker-compose logs backend | grep -i "health"
```

---

## 🗄️ Database Issues

### Migration fails

**Fix**:
```bash
# Ensure no other connections
docker-compose exec postgres psql -U nominas nominas_db -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='nominas_db' AND pid <> pg_backend_pid();"

# Reset migrations (CAUTION: destroys data)
docker-compose exec backend npx prisma migrate reset

# Or deploy fresh
docker-compose exec backend npx prisma migrate deploy
```

### Data integrity issues

**Use Prisma Studio**:
```bash
docker-compose exec backend npx prisma studio
# Access at http://localhost:5555
```

**Direct SQL**:
```bash
docker-compose exec postgres psql -U nominas nominas_db
```

---

## 🔄 Restart Procedures

### Restart single service

```bash
docker-compose restart backend
docker-compose restart frontend
docker-compose restart redis
```

### Full restart (clean)

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f backend
```

### Restart without downtime (rolling update)

If using Coolify or Kubernetes, rolling updates handle this automatically. For manual:

1. Start new version with `docker-compose up -d --no-deps --build backend`
2. Wait for health check to pass
3. Stop old instance: `docker-compose stop backend` (already replaced)

---

## 📞 Get Help

1. Check this guide's relevant section
2. Review logs carefully (they often tell exactly what's wrong)
3. Search existing GitHub issues
4. Create new issue with:
   - Docker version (`docker version`)
   - OS details
   - Relevant log snippets
   - Steps to reproduce

---

**Quick Reference Card** (save this):

| Issue | Command |
|-------|---------|
| Port 3000 busy | `netstat -ano \| findstr :3000 && taskkill /F /PID <PID>` |
| DB connection | `docker-compose exec backend ping postgres` |
| View logs | `docker-compose logs -f backend` |
| Restart service | `docker-compose restart backend` |
| Shell into container | `docker-compose exec backend sh` |
| Check health | `curl http://localhost:3000/api/health \| jq .` |
| Run migrations | `docker-compose exec backend npx prisma migrate deploy` |
| Reset DB (danger!) | `docker-compose exec backend npx prisma migrate reset` |
| Clear volume data | `docker-compose down -v` (⚠️ deletes all data) |

---

*Last updated: April 2026*