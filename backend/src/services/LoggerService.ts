import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

const transport = isDev
    ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
        }
    }
    : undefined;

const baseLogger = pino({
    level: logLevel,
    transport,
    base: undefined, // Remove pid and hostname in production logs too
});

/**
 * Creates a child logger with a specific context (service/module name)
 */
export const createLogger = (context: string) => {
    return baseLogger.child({ context });
};

/**
 * Default logger for general use
 */
export const logger = createLogger('app');

// Pre-configured service loggers for common modules
export const loggers = {
    inbox: createLogger('InboxService'),
    scheduler: createLogger('SchedulerService'),
    alert: createLogger('AlertService'),
    email: createLogger('EmailService'),
    backup: createLogger('BackupService'),
    inventory: createLogger('InventoryService'),
    auth: createLogger('AuthService'),
    api: createLogger('API'),
};

export default logger;
