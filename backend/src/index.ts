import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import 'express-async-errors';
import { prisma } from './lib/prisma';
import { createApp } from './app/createApp';
import { startInfrastructure, stopInfrastructure, validateRuntimeConfiguration } from './app/infrastructure';
import { loggers } from './services/LoggerService';
import { reportScheduler } from './services/ReportScheduler';

const { app, server: httpServer } = createApp();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const HOST = '0.0.0.0';
const log = loggers.api;

validateRuntimeConfiguration();

async function startServer() {
    try {
        log.info('Checking database connection...');
        await prisma.$connect();
        log.info('Database connected successfully');

        log.info('Starting background infrastructure...');
        startInfrastructure();

        log.info('Starting report scheduler (hourly check)...');
        reportScheduler.start(60 * 60 * 1000);

        log.info('Attempting to start HTTP server on ' + HOST + ':' + PORT);

        httpServer.on('error', (error: any) => {
            if (error.code === 'EADDRINUSE') {
                log.fatal({
                    port: PORT,
                    error: error.message
                }, 'Port conflict: port already in use');
                log.warn('Solutions:');
                log.warn('  1. Kill process using port ' + PORT + ': netstat -ano | findstr :' + PORT);
                log.warn('  2. Then kill it: taskkill /F /PID <PID>');
                log.warn('  3. Or change PORT in .env to use a different port');
            } else if (error.code === 'EACCES') {
                log.fatal({ port: PORT }, 'Permission denied: cannot bind to port ' + PORT + '. Use port > 1024 or run as Admin');
            } else {
                log.fatal({ error }, 'Server failed to start due to unexpected error');
            }

            process.exit(1);
        });

        httpServer.listen(PORT, HOST, () => {
            log.info({ port: PORT, host: HOST }, 'Backend running');
            if (process.env.SENTRY_DSN) {
                log.info('Sentry monitoring enabled');
            }
            log.info('Health endpoints:');
            log.info('  GET /api/health/liveness - Liveness probe');
            log.info('  GET /api/health/readiness - Readiness probe');
            log.info('  GET /api/health - Comprehensive health check');
        });

        (global as any).__SERVER__ = httpServer;

    } catch (error) {
        log.fatal({ error }, 'Failed to start server: ' + (error as Error).message);
        process.exit(1);
    }
}

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (shuttingDown) {
        return;
    }
    shuttingDown = true;

    log.info({ signal }, 'Graceful shutdown started');

    const server = (global as any).__SERVER__ || httpServer;
    if (server?.listening) {
        await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
                log.warn('Forcing HTTP connections closed after shutdown timeout');
                server.closeAllConnections?.();
                resolve();
            }, 10000);

            server.close((error?: Error) => {
                clearTimeout(timeout);
                if (error) {
                    log.error({ error }, 'Error closing HTTP server');
                } else {
                    log.info('HTTP server closed');
                }
                resolve();
            });
        });
    }

    try {
        reportScheduler.stop();
        await stopInfrastructure();
    } catch (error) {
        log.error({ error }, 'Error stopping infrastructure');
    }

    try {
        await prisma.$disconnect();
        log.info('Database disconnected');
        process.exit(0);
    } catch (error) {
        log.error({ error }, 'Error disconnecting database');
        process.exit(1);
    }
}

process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
    void shutdown('SIGINT');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: any) => {
    log.fatal({ error }, 'Uncaught Exception: ' + error.message);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
    log.fatal({ reason }, 'Unhandled Rejection');
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
});

// Only start server if this file is executed directly (not imported as a module)
// This allows tests to import app without starting the server
// path is imported at the top of the file (ESM-compatible).
const isDirectlyExecuted = process.argv[1] && (
    process.argv[1].endsWith('index.ts') ||
    process.argv[1].endsWith('index.js') ||
    process.argv[1].endsWith('src' + path.sep + 'index.ts') ||
    process.argv[1].endsWith('src' + path.sep + 'index.js')
);

if (isDirectlyExecuted) {
    void startServer();
}

// Export app for testing purposes
export { app };
