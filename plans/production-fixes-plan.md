# 🚨 Plan de Correcciones de Producción - EmpleadosManager

**Fecha:** 2026-05-29
**Estado:** Pendiente de implementación
**Autor:** Sisyphus (Auditoría automática)

---

## 📋 Resumen Ejecutivo

Se identificaron **37 problemas** en el sistema, clasificados en:
- 🔴 **17 Críticos** - Bloquean producción o causan pérdida de datos
- 🟠 **12 Altos** - Riesgo significativo de seguridad/integridad
- 🟡 **8 Medios** - Mejoras necesarias

---

## FASE 1: SEGURIDAD CRÍTICA (Días 1-2)

### 1.1 Auth Module - Correcciones de Seguridad

| # | Problema | Archivo | Solución | Esfuerzo |
|---|----------|---------|----------|----------|
| 1.1.1 | DNI case-sensitive triple query | `AuthService.ts:13-21` | Usar `mode: 'insensitive'` en una sola query | 15 min |
| 1.1.2 | Session version no se incrementa | `AuthService.ts` + `PasswordController.ts` | Agregar `increment: 1` al cambiar password | 30 min |
| 1.1.3 | Permission parsing silencioso | `authMiddleware.ts:74` | Agregar warning log cuando JSON es inválido | 10 min |

**Archivos a modificar:**
```
backend/src/services/AuthService.ts
backend/src/controllers/PasswordController.ts
backend/src/middlewares/authMiddleware.ts
```

### 1.2 TimeEntry - Geofencing y Kiosk

| # | Problema | Archivo | Solución | Esfuerzo |
|---|----------|---------|----------|----------|
| 1.2.1 | Geofencing bypassable | `TimeEntryController.ts:83` | Agregar validación de precisión GPS + log de coordenadas recibidas | 1 hora |
| 1.2.2 | Kiosk sin auth robusta | `KioskController.ts` | Implementar rate limiting en PIN + lockout después de 5 intentos | 2 horas |
| 1.2.3 | Timestamp manipulation | `TimeEntryController.ts:17` | Reducir maxPastMs de 24h a 1h, requerir justificación para fichajes antiguos | 30 min |

**Archivos a modificar:**
```
backend/src/controllers/TimeEntryController.ts
backend/src/controllers/KioskController.ts
backend/src/middlewares/rateLimiters.ts (nuevo)
```

### 1.3 Documents - OCR y Seguridad

| # | Problema | Archivo | Solución | Esfuerzo |
|---|----------|---------|----------|----------|
| 1.3.1 | OCR memory leak | `DocumentController.ts:32` | Singleton pattern para Tesseract worker | 1 hora |
| 1.3.2 | Missing virus scanning | `DocumentController.ts` | Integrar ClamAV o validación de magic bytes extendida | 2 horas |
| 1.3.3 | Employee access not checked | `DocumentController.ts:83` | Agregar verificación de company access antes de upload | 30 min |

**Archivos a modificar:**
```
backend/src/controllers/DocumentController.ts
backend/src/services/OcrService.ts (nuevo)
backend/src/middlewares/documentAccess.ts (nuevo)
```

---

## FASE 2: INTEGRIDAD DE DATOS (Días 2-3)

### 2.1 Employee - Multi-tenancy y Cascade

| # | Problema | Archivo | Solución | Esfuerzo |
|---|----------|---------|----------|----------|
| 2.1.1 | Cascade delete risks | `schema.prisma` | Revisar relations, agregar soft delete donde falta | 2 horas |
| 2.1.2 | Multi-tenancy inconsistente | Multiples controllers | Crear middleware `requireCompanyAccess` unificado | 2 horas |
| 2.1.3 | Sensitive data exposure | `EmployeeController.ts:194` | Filtrar campos sensibles en respuestas | 1 hora |
| 2.1.4 | Bulk update sin validación | `EmployeeController.ts:358` | Allowlist de campos permitidos por acción | 1 hora |

**Archivos a modificar:**
```
database/prisma/schema.prisma
backend/src/middlewares/companyAccess.ts (nuevo)
backend/src/controllers/EmployeeController.ts
backend/src/policies/employeeAccess.ts
```

### 2.2 Vacation - Race Conditions

| # | Problema | Archivo | Solución | Esfuerzo |
|---|----------|---------|----------|----------|
| 2.2.1 | Race condition en aprobación | `VacationController.ts` | SELECT FOR UPDATE antes de aprobar | 1 hora |
| 2.2.2 | No overlapping vacation check | `VacationRequestService.ts` | Query de superposición antes de crear | 1 hora |
| 2.2.3 | Balance calculation timing | `VacationBalanceService.ts` | Lock de año al calcular | 30 min |
| 2.2.4 | Cache invalidation incomplete | `VacationController.ts` | Invalidar todas las keys relacionadas | 15 min |

**Archivos a modificar:**
```
backend/src/controllers/VacationController.ts
backend/src/services/VacationRequestService.ts
backend/src/services/VacationBalanceService.ts
```

### 2.3 Payroll - Validación Financiera

| # | Problema | Archivo | Solución | Esfuerzo |
|---|----------|---------|----------|----------|
| 2.3.1 | Legacy file fallback | `PayrollController.ts:100` | Eliminar fallback, fallar si no hay storage | 30 min |
| 2.3.2 | No financial validation | `PayrollController.ts:328` | Validar neto <= bruto, montos positivos | 30 min |
| 2.3.3 | Batch status machine incompleta | `PayrollController.ts` | Agregar validador de transiciones de estado | 1 hora |
| 2.3.4 | No idempotency en upload | `PayrollController.ts:22` | Hash del archivo para detectar duplicados | 1 hora |

**Archivos a modificar:**
```
backend/src/controllers/PayrollController.ts
backend/src/services/PayrollBatchService.ts (nuevo)
```

---

## FASE 3: PERFORMANCE (Días 3-4)

### 3.1 Employee - N+1 Queries

| # | Problema | Archivo | Solución | Esfuerzo |
|---|----------|---------|----------|----------|
| 3.1.1 | N+1 en portability report | `EmployeeController.ts:675` | Usar include anidado con selects mínimos + paginación | 2 horas |

**Archivos a modificar:**
```
backend/src/controllers/EmployeeController.ts
```

### 3.2 Analytics - Cache

| # | Problema | Archivo | Solución | Esfuerzo |
|---|----------|---------|----------|----------|
| 3.2.1 | Heavy queries sin cache | `AnalyticsService.ts` | Implementar cache con TTL de 5 min para KPIs | 2 horas |
| 3.2.2 | Memory-intensive aggregations | `AnalyticsService.ts` | Usar cursor-based pagination para heatmaps | 1 hora |

**Archivos a modificar:**
```
backend/src/services/AnalyticsService.ts
backend/src/services/CacheService.ts
```

### 3.3 Notifications - Connection Management

| # | Problema | Archivo | Solución | Esfuerzo |
|---|----------|---------|----------|----------|
| 3.3.1 | SSE connection leak | `NotificationController.ts:36` | Agregar timeout de 30 min + cleanup periódico | 1 hora |
| 3.3.2 | No notification cleanup | `NotificationController.ts` | Job de limpieza para notificaciones > 30 días | 1 hora |

**Archivos a modificar:**
```
backend/src/controllers/NotificationController.ts
backend/src/workers/cleanupWorker.ts (nuevo)
```

### 3.4 WebSocket - Lock Management

| # | Problema | Archivo | Solución | Esfuerzo |
|---|----------|---------|----------|----------|
| 3.4.1 | Lock sin TTL | `LockService.ts` | TTL de 15 min + heartbeat para renovar | 1 hora |
| 3.4.2 | No reconnection handling | Frontend `useLock.ts` | Lógica de reconexión con exponential backoff | 1 hora |
| 3.4.3 | Missing room validation | `rooms.ts` | Verificar company access antes de join | 30 min |

**Archivos a modificar:**
```
backend/src/services/LockService.ts
backend/src/websocket/rooms.ts
frontend/src/hooks/useLock.ts
```

---

## FASE 4: INVENTARIO Y FLOTA (Días 4-5)

### 4.1 Inventory - Multi-tenancy

| # | Problema | Archivo | Solución | Esfuerzo |
|---|----------|---------|----------|----------|
| 4.1.1 | No company scoping | `InventoryController.ts:20` | Agregar filtro por empresa + campo `companyId` | 1 hora |
| 4.1.2 | Negative stock possible | `InventoryController.ts` | Validación `quantity >= 0` en salidas | 30 min |
| 4.1.3 | No audit trail | `InventoryController.ts` | Logging detallado de movimientos | 30 min |

**Archivos a modificar:**
```
database/prisma/schema.prisma (agregar companyId a InventoryItem)
backend/src/controllers/InventoryController.ts
```

### 4.2 Vehicle - Consistencia

| # | Problema | Archivo | Solución | Esfuerzo |
|---|----------|---------|----------|----------|
| 4.2.1 | Hardcoded fs operations | `VehicleController.ts:3` | Migrar a StorageService | 1 hora |
| 4.2.2 | No cleanup on deletion | `VehicleController.ts` | Agregar cleanup de archivos al eliminar | 30 min |
| 4.2.3 | VIN/Plate validation missing | `VehicleController.ts` | Expresiones regulares para matrícula/bastidor | 30 min |

**Archivos a modificar:**
```
backend/src/controllers/VehicleController.ts
backend/src/utils/validations.ts (nuevo)
```

---

## FASE 5: TESTING Y VERIFICACIÓN (Días 5-6)

### 5.1 Tests Unitarios

| # | Módulo | Archivos de test | Cobertura objetivo |
|---|--------|------------------|-------------------|
| 5.1.1 | Auth | `AuthService.test.ts` | 80% |
| 5.1.2 | Employee | `EmployeeController.test.ts` | 70% |
| 5.1.3 | Vacation | `VacationController.test.ts` | 70% |
| 5.1.4 | TimeEntry | `TimeEntryController.test.ts` | 70% |
| 5.1.5 | Payroll | `PayrollController.test.ts` | 60% |

### 5.2 Tests de Integración

| # | Escenario | Prioridad |
|---|-----------|-----------|
| 5.2.1 | Login → CRUD Employee → Logout | Alta |
| 5.2.2 | Crear vacación → Aprobar → Verificar balance | Alta |
| 5.2.3 | Fichar → Verificar geofencing → Ver historial | Alta |
| 5.2.4 | Subir nómina → Mapear → Generar PDF | Media |
| 5.2.5 | Subir documento → OCR → Clasificar | Media |

### 5.3 Verificación de Seguridad

| # | Prueba | Herramienta |
|---|--------|-------------|
| 5.3.1 | SQL Injection | sqlmap |
| 5.3.2 | XSS reflected/stored | OWASP ZAP |
| 5.3.3 | CSRF bypass | Manual testing |
| 5.3.4 | Rate limiting | siege |
| 5.3.5 | Authentication bypass | Manual testing |

---

## 📊 Estimación de Esfuerzo

| Fase | Días | Problemas | Complejidad |
|------|------|-----------|-------------|
| FASE 1: Seguridad Crítica | 2 | 9 | 🔴 Alta |
| FASE 2: Integridad de Datos | 2 | 12 | 🔴 Alta |
| FASE 3: Performance | 2 | 8 | 🟠 Media |
| FASE 4: Inventario y Flota | 1 | 6 | 🟡 Baja |
| FASE 5: Testing | 1 | - | 🟠 Media |
| **TOTAL** | **8 días** | **37** | - |

---

## 🎯 Criterios de Aceptación

### Por Fase:
- [ ] FASE 1: Todos los tests de seguridad pasan
- [ ] FASE 2: No hay errores de integridad en QA
- [ ] FASE 3: Response time < 200ms en endpoints críticos
- [ ] FASE 4: Inventario filtrado por empresa correctamente
- [ ] FASE 5: Cobertura de tests > 70%

### Global:
- [ ] No hay errores en logs de producción por 24h
- [ ] Todos los endpoints autenticados verifican company access
- [ ] Rate limiting funciona en todos los endpoints públicos
- [ ] Health checks responden correctamente

---

## 📝 Notas de Implementación

### Orden de implementación recomendado:
1. FASE 1 primero (seguridad bloquea todo)
2. FASE 2 segunda (integridad antes de performance)
3. FASE 3 tercera (optimizar después de corregir)
4. FASE 4 cuarta (módulos secundarios)
5. FASE 5 última (verificar todo)

### Dependencias:
- FASE 2.1.2 (multi-tenancy middleware) bloquea FASE 4.1.1 (inventory scoping)
- FASE 1.2.1 (geofencing) debe ir antes de FASE 2.1 (employee fixes)
- FASE 5 debe ir después de FASE 1-4

### Riesgos:
- Cambios en `schema.prisma` pueden requerir migraciones de BD
- Cambios en auth middleware pueden afectar todos los controllers
- Tests existentes pueden romperse con cambios de API

---

## 🔄 Seguimiento

Crear issues en el repo para cada problema:
```
[FASE 1] Auth: Fix DNI case-sensitive login
[FASE 1] TimeEntry: Fix geofencing bypass
[FASE 2] Employee: Add company access middleware
[FASE 2] Vacation: Fix race condition in approval
...
```

**Próximo paso:** Aprobar plan y empezar FASE 1.
