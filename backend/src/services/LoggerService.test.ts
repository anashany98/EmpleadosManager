import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, logger, loggers } from './LoggerService';

describe('LoggerService', () => {
    describe('createLogger', () => {
        it('should create a logger with context', () => {
            const testLogger = createLogger('TestService');
            expect(testLogger).toBeDefined();
        });

        it('should create different loggers for different contexts', () => {
            const logger1 = createLogger('Service1');
            const logger2 = createLogger('Service2');
            
            expect(logger1).not.toBe(logger2);
        });

        it('should create logger with string context', () => {
            const logger = createLogger('MyService');
            expect(logger).toBeDefined();
        });
    });

    describe('logger', () => {
        it('should have default app logger', () => {
            expect(logger).toBeDefined();
        });
    });

    describe('loggers', () => {
        it('should have inbox logger', () => {
            expect(loggers.inbox).toBeDefined();
        });

        it('should have scheduler logger', () => {
            expect(loggers.scheduler).toBeDefined();
        });

        it('should have alert logger', () => {
            expect(loggers.alert).toBeDefined();
        });

        it('should have email logger', () => {
            expect(loggers.email).toBeDefined();
        });

        it('should have backup logger', () => {
            expect(loggers.backup).toBeDefined();
        });

        it('should have inventory logger', () => {
            expect(loggers.inventory).toBeDefined();
        });

        it('should have auth logger', () => {
            expect(loggers.auth).toBeDefined();
        });

        it('should have api logger', () => {
            expect(loggers.api).toBeDefined();
        });

        it('should have all expected loggers', () => {
            const expected = ['inbox', 'scheduler', 'alert', 'email', 'backup', 'inventory', 'auth', 'api'];
            expected.forEach(name => {
                expect(loggers[name as keyof typeof loggers]).toBeDefined();
            });
        });
    });
});
