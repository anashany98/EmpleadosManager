import { Request, Response } from 'express';
import { HealthChecker } from '../services/HealthChecker';

let healthChecker: HealthChecker | null = null;

/**
 * DI container - set Prisma client from outside
 */
export function initializeHealthChecker(prisma: any): void {
    healthChecker = new HealthChecker(prisma);
}

export const healthController = {
    /**
     * Comprehensive health check endpoint
     * GET /api/health
     * Returns detailed status of all services
     * Access: Public (no auth required)
     */
    getHealth: async (_req: Request, res: Response): Promise<void> => {
        if (!healthChecker) {
            res.status(503).json({
                status: 'error',
                message: 'Health checker not initialized',
                timestamp: new Date().toISOString()
            });
            return;
        }

        try {
            const health = await healthChecker.checkAll();
            const statusCode = health.status === 'ok' ? 200 : health.status === 'degraded' ? 200 : 503;
            res.status(statusCode).json(health);
        } catch (error) {
            console.error('Health check error:', error);
            res.status(503).json({
                status: 'error',
                message: 'Health check failed',
                timestamp: new Date().toISOString()
            });
        }
    },

    /**
     * Liveness probe - quick check if app is running
     * GET /api/health/liveness
     * Used by Kubernetes/Docker for restart decisions
     */
    getLiveness: async (_req: Request, res: Response): Promise<void> => {
        if (!healthChecker) {
            res.status(503).json({ status: 'error', message: 'Not initialized' });
            return;
        }

        try {
            const result = await healthChecker.checkLiveness();
            const statusCode = result.status === 'ok' ? 200 : 503;
            res.status(statusCode).json(result);
        } catch (error) {
            res.status(503).json({ status: 'error', message: 'Liveness check failed' });
        }
    },

    /**
     * Readiness probe - check if app is ready to serve traffic
     * GET /api/health/readiness
     * Used by Kubernetes/Docker for traffic routing
     */
    getReadiness: async (_req: Request, res: Response): Promise<void> => {
        if (!healthChecker) {
            res.status(503).json({ status: 'error', message: 'Not initialized' });
            return;
        }

        try {
            const result = await healthChecker.checkReadiness();
            const statusCode = result.status === 'ok' ? 200 : 503;
            res.status(statusCode).json(result);
        } catch (error) {
            res.status(503).json({ status: 'error', message: 'Readiness check failed' });
        }
    }
};
