#!/usr/bin/env node
// External health monitor that runs from a CRON on a SEPARATE
// machine (not on the same server as the app). It pings the health
// endpoints and sends an email/SMS/webhook if any are down.
//
// Use this as a backup to UptimeRobot. Configure it on a free-tier
// cloud VM (Oracle free tier, Hetzner, fly.io) so that an outage of
// the main server still triggers the alert.
//
// Usage:
//   node scripts/external-monitor.mjs
//
// Environment:
//   MONITOR_URLS=https://rrhh.example.com/api/health/liveness,...
//   ALERT_WEBHOOK_URL=https://hooks.slack.com/services/...
//   CHECK_INTERVAL_SECONDS=60

import process from 'node:process';
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';

const URLS = (process.env.MONITOR_URLS || 'https://rrhh.example.com/api/health/liveness')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const WEBHOOK = process.env.ALERT_WEBHOOK_URL || '';
const INTERVAL = parseInt(process.env.CHECK_INTERVAL_SECONDS || '60', 10) * 1000;
const TIMEOUT_MS = 10_000;
const MAX_CONSECUTIVE_FAILURES = 2;

const state = new Map(); // url -> { lastStatus, consecutiveFailures, lastChecked }

function ping(url) {
    return new Promise((resolve) => {
        const parsed = new URL(url);
        const mod = parsed.protocol === 'https:' ? https : http;
        const req = mod.get(parsed, { timeout: TIMEOUT_MS }, (res) => {
            resolve({ ok: res.statusCode >= 200 && res.statusCode < 500, status: res.statusCode });
        });
        req.on('timeout', () => {
            req.destroy();
            resolve({ ok: false, status: 0, error: 'timeout' });
        });
        req.on('error', (err) => {
            resolve({ ok: false, status: 0, error: err.message });
        });
    });
}

async function alert(subject, body) {
    if (!WEBHOOK) {
        console.error(`[alert] ${subject}\n${body}`);
        return;
    }
    try {
        const parsed = new URL(WEBHOOK);
        const mod = parsed.protocol === 'https:' ? https : http;
        const data = JSON.stringify({ text: `*${subject}*\n${body}` });
        const req = mod.request(parsed, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
            timeout: 5000
        });
        req.write(data);
        req.end();
    } catch (err) {
        console.error('Failed to send alert webhook', err);
    }
}

async function check() {
    for (const url of URLS) {
        const result = await ping(url);
        const prev = state.get(url) || { lastStatus: null, consecutiveFailures: 0, lastChecked: null };
        prev.lastChecked = new Date().toISOString();

        if (result.ok) {
            if (prev.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                await alert(`✅ Recovered: ${url}`, `Service is back UP. Status: ${result.status}.`);
            }
            prev.consecutiveFailures = 0;
            prev.lastStatus = result.status;
            state.set(url, prev);
            console.log(`[OK] ${url} status=${result.status}`);
        } else {
            prev.consecutiveFailures++;
            prev.lastStatus = result.status;
            state.set(url, prev);
            console.error(`[FAIL #${prev.consecutiveFailures}] ${url} status=${result.status} error=${result.error || ''}`);
            if (prev.consecutiveFailures === MAX_CONSECUTIVE_FAILURES) {
                await alert(
                    `🚨 DOWN: ${url}`,
                    `Service has been down for ${MAX_CONSECUTIVE_FAILURES} consecutive checks. Last status: ${result.status}. Error: ${result.error || 'unknown'}.`
                );
            }
        }
    }
}

console.log(`[monitor] Watching ${URLS.length} URL(s), interval=${INTERVAL / 1000}s`);
console.log(`[monitor] Webhook: ${WEBHOOK ? 'configured' : 'NOT configured (alerts go to stderr only)'}`);

async function loop() {
    while (true) {
        try {
            await check();
        } catch (err) {
            console.error('[monitor] check() threw', err);
        }
        await new Promise((r) => setTimeout(r, INTERVAL));
    }
}

loop();
