import dotenv from 'dotenv';
dotenv.config();

import 'express-async-errors';
import { prisma } from './lib/prisma';
import { createApp } from './app/createApp';
import { startInfrastructure, stopInfrastructure, validateRuntimeConfiguration } from './app/infrastructure';
import { loggers } from './services/LoggerService';

const app = createApp();
const PORT = process.env.PORT || 3000;
const log = loggers.api;

validateRuntimeConfiguration();

async function startServer() {
    try {
        log.info('Checking database connection...');
        await prisma.$connect();
        log.info('Database connected successfully');

        startInfrastructure();

        app.listen(Number(PORT), '0.0.0.0', () => {
            log.info({ port: PORT, host: '0.0.0.0' }, 'Backend running');
        });
    } catch (error) {
        log.fatal({ error }, 'Failed to connect to database');
        process.exit(1);
    }
}

const gracefulShutdown = () => {
    log.info('Received kill signal, shutting down gracefully');
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

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

void startServer();

export { app };
