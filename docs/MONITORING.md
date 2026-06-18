# Monitoring externo — UptimeRobot / BetterStack

Coolify tiene health checks internos, pero **no envía alertas externas** si el servidor se cae. Necesitas un servicio externo que sondee tu `/api/health/liveness` cada 1-5 minutos y te avise por email/SMS/Slack.

---

## Opción A: UptimeRobot (gratis hasta 50 monitores)

1. Crear cuenta en https://uptimerobot.com
2. **Add New Monitor**:
   - **Monitor Type**: `HTTP(s)`
   - **Friendly Name**: `RRHH Producción - Liveness`
   - **URL**: `https://rrhh.example.com/api/health/liveness`
   - **Monitoring Interval**: `1 minute` (free tier max)
3. Configurar **Alert Contacts**:
   - Email del equipo
   - (Opcional) Telegram/Discord/Slack webhook
4. Repetir para `/api/health/readiness` y `/` (frontend)
5. **Crear un status page público** (opcional): https://stats.uptimerobot.com/...

### Configuración recomendada de thresholds

- **Interval**: 1 min (free) o 30s (pro)
- **Timeout**: 30s
- **Retries**: 2 (para evitar falsos positivos por blip de red)

## Opción B: BetterStack (mejor UX, free tier de 10 monitors)

1. Crear cuenta en https://betterstack.com
2. **Monitors** → **Add Monitor** → `HTTP(s)`
3. Configurar URL + intervalo (30s mínimo)
4. Alertar via email, Slack, MS Teams, PagerDuty
5. **Heartbeat monitoring** (alternativa): UptimeRobot ping a una URL `/api/heartbeat` cada 60s; si no llega ping, alerta

---

## Health endpoints disponibles

| Endpoint | Qué chequea | Cuándo alertar |
|---|---|---|
| `GET /api/health/liveness` | El proceso Node está vivo | Inmediato (downtime) |
| `GET /api/health/readiness` | DB + Redis + colas operativas | Inmediato (no puede servir tráfico) |
| `GET /api/health` | Detalle completo (DB, Redis, disk, queues) | Para diagnóstico, no para alertar |

Configura los 3 en UptimeRobot pero **alerta solo con liveness y readiness**.

## Heartbeat alternativo (para kioskos sin DNS público)

Si parte de tu infra está en una red privada (kioskos, jobs internos), un heartbeat es más fiable que un HTTP check:

```bash
# En el kiosk server, cron cada 60s:
* * * * * curl -fsS https://uptime.betterstack.com/api/v1/heartbeat/<UNIQUE_ID>
```

Si BetterStack no recibe el ping en 2 min, alerta.

---

## Configurar alerta de Slack (ejemplo)

1. En Slack: **Apps** → **Incoming Webhooks** → crear webhook para `#alertas-rrhh`
2. URL del webhook: `https://hooks.slack.com/services/T.../B.../...`
3. En UptimeRobot: **Alert Contacts** → **Add Alert Contact** → **Slack Incoming Webhook**
4. Probar: en UptimeRobot, **Test alert contact** con un monitor pausado

---

## Dashboards externos

Además de las alertas, considera:
- **Grafana Cloud** (free tier 10k series): dashboards de CPU/RAM/disk/requests
- **Sentry** (ya configurado en el proyecto): errores de aplicación en tiempo real
- **Coolify metrics** (built-in): CPU, RAM, network por container

---

## Checklist post-setup

- [ ] 3 monitores HTTP en UptimeRobot (liveness, readiness, frontend)
- [ ] Alertas por email configuradas
- [ ] Alertas por Slack/Discord configuradas (opcional)
- [ ] Test de alerta (pausar un monitor y verificar que llega la alerta)
- [ ] Status page público creado y enlazado desde la app
- [ ] Sentry alert rules configurados para production
- [ ] Documento de contacto de guardia actualizado con la info de alertas
