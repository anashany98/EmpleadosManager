import dotenv from 'dotenv';
dotenv.config();

import 'express-async-errors';
import { prisma } from './lib/prisma';
import { createApp } from './app/createApp';
import { startInfrastructure, stopInfrastructure, validateRuntimeConfiguration } from './app/infrastructure';
import { loggers } from './services/LoggerService';
import { errorMiddleware } from './middlewares/errorMiddleware';

const app = createApp();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const HOST = '0.0.0.0';
const log = loggers.api;

validateRuntimeConfiguration();

async function startServer() {
    let server: any = null;

    try {
        log.info('Checking database connection...');
        await prisma.$connect();
        log.info('Database connected successfully');

        log.info('Starting background infrastructure...');
        startInfrastructure();

        log.info('Attempting to start HTTP server on ' + HOST + ':' + PORT);
        
        // Start server
        server = app.listen(PORT, HOST, () => {
            log.info({ port: PORT, host: HOST }, 'Backend running');
            if (process.env.SENTRY_DSN) {
                log.info('Sentry monitoring enabled');
            }
            log.info('Health endpoints:');
            log.info('  GET /api/health/liveness - Liveness probe');
            log.info('  GET /api/health/readiness - Readiness probe');
            log.info('  GET /api/health - Comprehensive health check');
        });

        // Handle server errors (including EADDRINUSE)
        server.on('error', (error: any) => {
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

        // Store server reference for graceful shutdown
        (global as any).__SERVER__ = server;

    } catch (error) {
        // Database or infrastructure errors
        log.fatal({ error }, 'Failed to start server: ' + (error as Error).message);
        process.exit(1);
    }
}

const gracefulShutdown = () => {
    log.info('Received termination signal, shutting down gracefully...');
    
    const server = (global as any).__SERVER__;
    
    // Stop accepting new connections
    if (server) {
        server.close(() => {
            log.info('HTTP server closed');
        });
        
        // Force close after timeout
        setTimeout(() => {
            if (server && !server.closed) {
                log.warn('Forcing server close after timeout');
                server.destroy();
            }
        }, 10000);
    }

    stopInfrastructure()
        .catch((error) => log.error({ error }, 'Error stopping infrastructure'))
        .finally(() => {
            prisma.$disconnect()
                .then(() => {
                    log.info('Database disconnected');
                    process.exit(0);
                })
                .catch((error) => {
                    log.error({ error }, 'Error disconnecting database');
                    process.exit(1);
                });
        });
};

// Handle uncaught exceptions
process.on('uncaughtException', (error: any) => {
    log.fatal({ error }, 'Uncaught Exception: ' + error.message);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
    log.error({ reason }, 'Unhandled Rejection');
    // Don't exit - let process managers restart
});

// Only start server if this file is executed directly (not imported as a module)
// This allows tests to import app without starting the server
if (require.main === module) {
    void startServer();
}

// Export app for testing purposes
export { app };
