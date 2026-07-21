import { PrismaClient } from '@prisma/client';
import v8 from 'v8';
import { createLogger } from './LoggerService';
import { queueService } from './QueueService';
import { redis as redisConnection } from '../config/redis';
import fs from 'fs';
import path from 'path';

const log = createLogger('HealthChecker');

export interface HealthStatus {
    status: 'ok' | 'degraded' | 'error';
    timestamp: string;
    uptime: number;
    services: {
        database: ServiceHealth;
        redis: ServiceHealth;
        diskSpace: ServiceHealth & { freeGB: number; totalGB: number; usedGB: number };
        memory: ServiceHealth & { usedMB: number; totalMB: number; freeMB: number };
        queues: ServiceHealth & { details?: Record<string, { pending: number; active: number; failed: number }> };
    };
    version: string;
    environment: string;
    nodeVersion: string;
}

export interface ServiceHealth {
    status: 'ok' | 'degraded' | 'error';
    message?: string;
    latencyMs?: number;
}

/**
 * Performs deep health checks on all critical infrastructure components
 * Used by /api/health endpoint and monitoring systems
 */
export class HealthChecker {
    private prisma: PrismaClient;
    private startTime: number;
    private version: string;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
        this.startTime = Date.now();
        this.version = this.getVersion();
    }

    private getVersion(): string {
        try {
            const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8'));
            return pkg.version || 'unknown';
        } catch {
            return 'unknown';
        }
    }

    /**
     * Main health check method - returns comprehensive system status
     */
    async checkAll(): Promise<HealthStatus> {
        const services: HealthStatus['services'] = {
            database: await this.checkDatabase(),
            redis: await this.checkRedis(),
            diskSpace: await this.checkDiskSpace(),
            memory: await this.checkMemory(),
            queues: await this.checkQueues(),
        };

        // Determine overall status based on service statuses
        const statuses = Object.values(services).map(s => s.status);
        const overallStatus = statuses.includes('error')
            ? 'error'
            : statuses.includes('degraded')
                ? 'degraded'
                : 'ok';

        return {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            uptime: Date.now() - this.startTime,
            services,
            version: this.version,
            environment: process.env.NODE_ENV || 'development',
            nodeVersion: process.version,
        };
    }

    /**
     * Lightweight health check for load balancer / container orchestration
     * Only checks essential services, returns quickly
     */
    async checkLiveness(): Promise<{ status: 'ok' | 'error' }> {
        try {
            // Quick DB connectivity check
            await this.prisma.$queryRaw`SELECT 1`;
            return { status: 'ok' };
        } catch (error) {
            log.error({ error }, 'Liveness check failed');
            return { status: 'error' };
        }
    }

    /**
     * Full readiness check - ensures all services are fully operational
     */
    async checkReadiness(): Promise<{ status: 'ok' | 'error'; message?: string }> {
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            // Could add Redis ping here if needed
            return { status: 'ok' };
        } catch {
            return { status: 'error', message: 'Database not ready' };
        }
    }

    private async checkDatabase(): Promise<ServiceHealth> {
        const start = Date.now();
        try {
            // Run a simple query
            await this.prisma.$queryRaw`SELECT 1`;
            const latency = Date.now() - start;

            // Check connection count (optional)
            const result = await this.prisma.$queryRaw<{ count: bigint }[]>`
                SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()
            `;
            const connections = result[0]?.count || BigInt(0);

            let message: string | undefined;
            if (connections > 50) {
                message = `High connection count: ${connections}`;
            }

            return {
                status: latency > 1000 ? 'degraded' : 'ok',
                latencyMs: latency,
                message,
            };
        } catch (error) {
            log.error({ error }, 'Database health check failed');
            return {
                status: 'error',
                message: 'Database connection failed',
            };
        }
    }

    private async checkRedis(): Promise<ServiceHealth> {
        const start = Date.now();
        try {
            const redis = redisConnection;
            await redis.ping();
            const latency = Date.now() - start;

            return {
                status: latency > 500 ? 'degraded' : 'ok',
                latencyMs: latency,
            };
        } catch (error) {
            log.error({ error }, 'Redis health check failed');
            return {
                status: 'error',
                message: 'Redis connection failed',
            };
        }
    }

    private async checkDiskSpace(): Promise<ServiceHealth & { freeGB: number; totalGB: number; usedGB: number }> {
        try {
            const { exec } = await import('child_process');
            
            return new Promise((resolve) => {
                // Use df command to get disk space (works on Linux/Docker containers)
                exec('df -BG --output=size,used,avail / | tail -1', { timeout: 5000 }, (error, stdout) => {
                    if (error || !stdout) {
                        // Fallback for non-Linux or if df fails
                        exec('df -k .', { timeout: 5000 }, (err, out) => {
                            if (err || !out) {
                                resolve({
                                    status: 'error' as const,
                                    freeGB: 0,
                                    totalGB: 0,
                                    usedGB: 0,
                                    message: 'Unable to check disk space',
                                });
                                return;
                            }
                            
                            const lines = out.trim().split('\n');
                            if (lines.length >= 2) {
                                const parts = lines[1].split(/\s+/);
                                if (parts.length >= 4) {
                                    const totalKB = parseInt(parts[1], 10);
                                    const usedKB = parseInt(parts[2], 10);
                                    const freeKB = parseInt(parts[3], 10);
                                    
                                    const totalGB = Math.round(totalKB / 1024 / 1024);
                                    const usedGBVal = Math.round(usedKB / 1024 / 1024);
                                    const freeGBVal = Math.round(freeKB / 1024 / 1024);
                                    
                                    const status = freeGBVal < 1 ? 'degraded' : 'ok';
                                    const message = freeGBVal < 1 ? `Low disk space: ${freeGBVal}GB remaining` : undefined;
                                    
                                    resolve({
                                        status,
                                        freeGB: freeGBVal,
                                        totalGB,
                                        usedGB: usedGBVal,
                                        message,
                                    });
                                    return;
                                }
                            }
                            
                            resolve({
                                status: 'error' as const,
                                freeGB: 0,
                                totalGB: 0,
                                usedGB: 0,
                                message: 'Unable to parse disk space output',
                            });
                        });
                        return;
                    }
                    
                    const parts = stdout.trim().split(/\s+/);
                    if (parts.length >= 3) {
                        const totalGB = parseInt(parts[0].replace('G', ''), 10) || 0;
                        const usedGBVal = parseInt(parts[1].replace('G', ''), 10) || 0;
                        const freeGBVal = parseInt(parts[2].replace('G', ''), 10) || 0;
                        
                        const status = freeGBVal < 1 ? 'degraded' : 'ok';
                        const message = freeGBVal < 1 ? `Low disk space: ${freeGBVal}GB remaining` : undefined;
                        
                        resolve({
                            status,
                            freeGB: freeGBVal,
                            totalGB,
                            usedGB: usedGBVal,
                            message,
                        });
                    } else {
                        resolve({
                            status: 'error' as const,
                            freeGB: 0,
                            totalGB: 0,
                            usedGB: 0,
                            message: 'Unexpected df output format',
                        });
                    }
                });
            });
        } catch {
            return {
                status: 'error',
                freeGB: 0,
                totalGB: 0,
                usedGB: 0,
                message: 'Unable to check disk space',
            };
        }
    }

    /**
     * Memory health check. MED-009: expuesto como público (no
     * private) para que los tests puedan inyectar valores
     * concretos de `v8.getHeapStatistics()` y verificar que
     * los tres estados (ok / degraded / error) son
     * alcanzables. Antes el orden de umbrales hacía `error`
     * inalcanzable.
     */
    public checkMemory(): ServiceHealth & { usedMB: number; totalMB: number; freeMB: number } {
        try {
            // MED-009: usar `v8.getHeapStatistics().heap_size_limit`
            // (límite duro configurable vía --max-old-space-size) en
            // vez de `heapTotal`, que es el tamaño actual del heap
            // V8 y crece dinámicamente. Sin este cambio, el %
            // calculado es engañoso: un proceso con 200MB usados de
            // 256MB totales reporta 78% aunque el límite real sea
            // 4GB. Con el límite duro, 200MB / 4GB = 5% es la
            // medida correcta para "qué tan cerca del OOM estoy".
            const heapStats = v8.getHeapStatistics();
            const heapLimitBytes = heapStats.heap_size_limit;
            const heapLimitMB = Math.round(heapLimitBytes / (1024 * 1024));
            const usedMB = Math.round(heapStats.used_heap_size / (1024 * 1024));
            // `heapTotal` se sigue reportando para diagnóstico
            // (cuánto V8 ha reservado realmente ahora).
            const totalMB = Math.round(heapStats.total_heap_size / (1024 * 1024));
            // El "free" en el límite duro es trivial: limit - used.
            // No reportamos memoria del sistema porque Node no
            // expone `free` de forma portable sin módulos nativos.
            const freeMB = Math.max(0, heapLimitMB - usedMB);

            const usagePercent = (usedMB / heapLimitMB) * 100;
            // MED-009: el bug original era
            //   `usage>90 ? degraded : usage>95 ? error : ok`
            // que hace `error` inalcanzable (si usage>95 entonces
            // usage>90 es true y la primera rama gana). Invertir
            // el orden para que el umbral más alto se evalúe
            // primero.
            const status = usagePercent > 95
                ? 'error'
                : usagePercent > 90
                    ? 'degraded'
                    : 'ok';

            let message: string | undefined;
            if (status !== 'ok') {
                message = `High memory usage: ${usagePercent.toFixed(1)}% (${usedMB}MB / ${heapLimitMB}MB heap limit)`;
            }

            return {
                status,
                usedMB,
                totalMB,
                freeMB,
                message,
            };
        } catch {
            return {
                status: 'error',
                usedMB: 0,
                totalMB: 0,
                freeMB: 0,
                message: 'Unable to check memory',
            };
        }
    }

    private async checkQueues(): Promise<ServiceHealth & { details?: Record<string, { pending: number; active: number; failed: number }> }> {
        try {
            const queues = ['ingestion-queue', 'ocr-queue'] as const;
            const details: Record<string, { pending: number; active: number; failed: number }> = {};

            for (const queueName of queues) {
                const queue = queueService.getQueue(queueName);
                if (queue) {
                    const [pending, active, failed] = await Promise.all([
                        queue.getJobCounts('waiting').then(c => c.waiting),
                        queue.getJobCounts('active').then(c => c.active),
                        queue.getJobCounts('failed').then(c => c.failed),
                    ]);
                    details[queueName] = { pending, active, failed };
                }
            }

            // Check if any queue has excessive backlog
            const hasBacklog = Object.values(details).some(q => q.pending > 1000);
            const status = hasBacklog ? 'degraded' : 'ok';

            let message: string | undefined;
            if (hasBacklog) {
                const backlogs = Object.entries(details)
                    .filter(([, counts]) => counts.pending > 1000)
                    .map(([name, counts]) => `${name}: ${counts.pending} pending`);
                message = `Queue backlog detected: ${backlogs.join(', ')}`;
            }

            return { status, details, message };
        } catch (error) {
            log.error({ error }, 'Queue health check failed');
            return {
                status: 'error',
                message: 'Unable to check queues',
            };
        }
    }
}





