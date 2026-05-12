import { describe, it, expect } from 'vitest';
import { AuditService, AuditAction, AuditEntity } from '../../services/AuditService';

describe('AuditService Security Tests', () => {
    describe('logLoginSuccess', () => {
        it('should log successful login without throwing', async () => {
            await expect(
                AuditService.logLoginSuccess('user-123', '192.168.1.1', 'Mozilla/5.0')
            ).resolves.not.toThrow();
        });
    });

    describe('logLoginFailed', () => {
        it('should log failed login without throwing', async () => {
            await expect(
                AuditService.logLoginFailed(
                    'invalid@email.com',
                    'Invalid credentials',
                    '192.168.1.1',
                    'Mozilla/5.0'
                )
            ).resolves.not.toThrow();
        });
    });

    describe('logAccessDenied', () => {
        it('should log access denied without throwing', async () => {
            await expect(
                AuditService.logAccessDenied(
                    'user-123',
                    '/api/admin',
                    'Insufficient permissions',
                    '192.168.1.1'
                )
            ).resolves.not.toThrow();
        });
    });

    describe('logSecurityEvent', () => {
        it('should log security event with metadata', async () => {
            await expect(
                AuditService.logSecurityEvent(AuditAction.SECURITY_VIOLATION, {
                    reason: 'Multiple failed login attempts',
                    userId: 'user-456',
                    ipAddress: '10.0.0.1',
                    metadata: { attempts: 5 }
                })
            ).resolves.not.toThrow();
        });
    });

    describe('getSecurityLogs', () => {
        it('should retrieve security logs with pagination', async () => {
            const result = await AuditService.getSecurityLogs(
                {},
                { page: 1, limit: 10 }
            );
            
            expect(result.logs).toBeDefined();
            expect(result.pagination).toBeDefined();
            expect(result.pagination.page).toBe(1);
            expect(result.pagination.limit).toBe(10);
        });
    });

    describe('getLogs with filters', () => {
        it('should retrieve logs filtered by entity', async () => {
            const result = await AuditService.getLogs(
                { entity: AuditEntity.USER },
                { page: 1, limit: 10 }
            );
            
            expect(result.logs).toBeDefined();
            expect(Array.isArray(result.logs)).toBe(true);
        });

        it('should retrieve logs filtered by date range', async () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date();
            
            const result = await AuditService.getLogs(
                { startDate, endDate },
                { page: 1, limit: 10 }
            );
            
            expect(result.logs).toBeDefined();
        });
    });
});