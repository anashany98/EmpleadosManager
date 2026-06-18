import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be declared before imports (hoisted by vitest)
vi.mock('../../lib/prisma', () => {
    const mockAuditLog = {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn()
    };
    return {
        prisma: { auditLog: mockAuditLog }
    };
});

vi.mock('../../services/AuditService', () => ({
    AuditService: {
        log: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('../../services/EmailService', () => ({
    EmailService: {
        sendMail: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('../../services/LoggerService', () => ({
    createLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        fatal: vi.fn()
    })
}));

import {
    BreachNotificationService,
    reportBreach,
    markAuthorityNotified,
    markSubjectsNotified,
    checkOverdueBreachNotifications
} from '../../services/BreachNotificationService';
import { prisma } from '../../lib/prisma';
import { AuditService } from '../../services/AuditService';
import { EmailService } from '../../services/EmailService';

beforeEach(() => {
    vi.clearAllMocks();
});

describe('BreachNotificationService', () => {
    describe('reportBreach', () => {
        it('creates a breach incident and logs it to audit', async () => {
            const result = await reportBreach({
                severity: 'HIGH',
                title: 'Test breach',
                description: 'A test data breach',
                dataCategories: ['SALARY', 'DNI'],
                affectedRecordCount: 50,
                createdBy: 'admin-1'
            });

            expect(result).toBeDefined();
            expect(result.id).toMatch(/^breach_\d+_/);
            expect(result.severity).toBe('HIGH');
            expect(result.title).toBe('Test breach');
            expect(result.description).toBe('A test data breach');
            expect(result.dataCategories).toEqual(['SALARY', 'DNI']);
            expect(result.affectedRecordCount).toBe(50);
            expect(result.status).toBe('OPEN');
            expect(result.authorityNotifiedAt).toBeNull();
            expect(result.subjectsNotifiedAt).toBeNull();
            expect(result.createdBy).toBe('admin-1');
            // Deadline should be ~72h from now
            const expectedDeadline = new Date(result.detectedAt.getTime() + 72 * 60 * 60 * 1000);
            expect(result.authorityNotificationDeadline.getTime()).toBeCloseTo(expectedDeadline.getTime(), -3);
        });

        it('persists the breach to AuditService.log', async () => {
            await reportBreach({
                severity: 'MEDIUM',
                title: 'Audit test',
                description: 'Testing audit trail',
                dataCategories: ['IBAN'],
                createdBy: 'admin-2'
            });

            expect(AuditService.log).toHaveBeenCalledWith(
                'DATA_BREACH_REPORTED',
                'BREACH',
                'pending',
                expect.objectContaining({
                    severity: 'MEDIUM',
                    title: 'Audit test',
                    dataCategories: ['IBAN']
                }),
                'admin-2'
            );
        });

        it('sends DPO notification email for HIGH severity breaches', async () => {
            process.env.DPO_EMAIL = 'dpo@test.com';

            await reportBreach({
                severity: 'HIGH',
                title: 'High breach',
                description: 'Severe',
                dataCategories: ['MEDICAL'],
                createdBy: 'admin-1'
            });

            expect(EmailService.sendMail).toHaveBeenCalledTimes(1);
            const [to, subject] = (EmailService.sendMail as any).mock.calls[0];
            expect(to).toBe('dpo@test.com');
            expect(subject).toContain('HIGH');
            expect(subject).toContain('High breach');

            delete process.env.DPO_EMAIL;
        });

        it('sends DPO notification email for CRITICAL severity breaches', async () => {
            await reportBreach({
                severity: 'CRITICAL',
                title: 'Critical breach',
                description: 'Very severe',
                dataCategories: ['SALARY', 'DNI', 'IBAN'],
                createdBy: 'admin-1'
            });

            expect(EmailService.sendMail).toHaveBeenCalledTimes(1);
        });

        it('does NOT send DPO email for LOW or MEDIUM severity breaches', async () => {
            await reportBreach({
                severity: 'LOW',
                title: 'Low breach',
                description: 'Minor',
                dataCategories: ['SALARY'],
                createdBy: 'admin-1'
            });

            await reportBreach({
                severity: 'MEDIUM',
                title: 'Medium breach',
                description: 'Moderate',
                dataCategories: ['SALARY'],
                createdBy: 'admin-1'
            });

            expect(EmailService.sendMail).not.toHaveBeenCalled();
        });

        it('handles email send failure gracefully (does not throw)', async () => {
            (EmailService.sendMail as any).mockRejectedValueOnce(new Error('SMTP down'));

            const result = await reportBreach({
                severity: 'CRITICAL',
                title: 'Will fail email',
                description: 'Test',
                dataCategories: ['DNI'],
                createdBy: 'admin-1'
            });

            // Should still return the incident even if email fails
            expect(result).toBeDefined();
            expect(result.severity).toBe('CRITICAL');
        });

        it('uses default values for optional fields', async () => {
            const result = await reportBreach({
                severity: 'HIGH',
                title: 'Minimal breach',
                description: 'Minimal',
                dataCategories: ['SALARY'],
                createdBy: 'admin-1'
            });

            expect(result.affectedEmployeeIds).toEqual([]);
            expect(result.affectedRecordCount).toBe(0);
            expect(result.containmentSteps).toEqual([]);
            expect(result.notes).toBeUndefined();
        });

        it('respects provided optional fields', async () => {
            const result = await reportBreach({
                severity: 'HIGH',
                title: 'Full breach',
                description: 'Full',
                affectedEmployeeIds: ['emp-1', 'emp-2'],
                affectedRecordCount: 100,
                dataCategories: ['SALARY', 'IBAN'],
                containmentSteps: ['Revoked access', 'Reset passwords'],
                createdBy: 'admin-1',
                notes: 'Internal note'
            });

            expect(result.affectedEmployeeIds).toEqual(['emp-1', 'emp-2']);
            expect(result.affectedRecordCount).toBe(100);
            expect(result.containmentSteps).toEqual(['Revoked access', 'Reset passwords']);
            expect(result.notes).toBe('Internal note');
        });
    });

    describe('markAuthorityNotified', () => {
        it('logs authority notification to audit trail', async () => {
            await markAuthorityNotified('breach-123');

            expect(AuditService.log).toHaveBeenCalledWith(
                'DATA_BREACH_AUTHORITY_NOTIFIED',
                'BREACH',
                'breach-123',
                expect.objectContaining({ notifiedAt: expect.any(String) }),
                'system'
            );
        });

        it('accepts custom notification date', async () => {
            const customDate = new Date('2026-06-20T10:00:00Z');
            await markAuthorityNotified('breach-456', customDate);

            expect(AuditService.log).toHaveBeenCalledWith(
                'DATA_BREACH_AUTHORITY_NOTIFIED',
                'BREACH',
                'breach-456',
                { notifiedAt: customDate.toISOString() },
                'system'
            );
        });
    });

    describe('markSubjectsNotified', () => {
        it('logs subject notification to audit trail', async () => {
            await markSubjectsNotified('breach-789');

            expect(AuditService.log).toHaveBeenCalledWith(
                'DATA_BREACH_SUBJECTS_NOTIFIED',
                'BREACH',
                'breach-789',
                expect.objectContaining({ notifiedAt: expect.any(String) }),
                'system'
            );
        });

        it('accepts custom notification date', async () => {
            const customDate = new Date('2026-06-25T14:30:00Z');
            await markSubjectsNotified('breach-999', customDate);

            expect(AuditService.log).toHaveBeenCalledWith(
                'DATA_BREACH_SUBJECTS_NOTIFIED',
                'BREACH',
                'breach-999',
                { notifiedAt: customDate.toISOString() },
                'system'
            );
        });
    });

    describe('checkOverdueBreachNotifications', () => {
        it('returns empty when no overdue breaches', async () => {
            (prisma.auditLog.findMany as any)
                .mockResolvedValueOnce([]) // recentBreaches
                .mockResolvedValueOnce([]); // notifications

            const result = await checkOverdueBreachNotifications();

            expect(result.overdueCount).toBe(0);
            expect(result.incidents).toEqual([]);
        });

        it('identifies overdue breaches (reported >72h ago without authority notification)', async () => {
            const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

            (prisma.auditLog.findMany as any)
                .mockResolvedValueOnce([
                    {
                        entityId: 'breach-1',
                        createdAt: fourDaysAgo,
                        metadata: JSON.stringify({ title: 'Old breach' })
                    }
                ])
                .mockResolvedValueOnce([]); // no notifications

            const result = await checkOverdueBreachNotifications();

            expect(result.overdueCount).toBe(1);
            expect(result.incidents).toHaveLength(1);
            expect(result.incidents[0].id).toBe('breach-1');
            expect(result.incidents[0].title).toBe('Old breach');
            expect(result.incidents[0].hoursOverdue).toBeGreaterThanOrEqual(24); // 4 days - 72h = 24h overdue
        });

        it('excludes breaches that have been notified to authority', async () => {
            const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

            (prisma.auditLog.findMany as any)
                .mockResolvedValueOnce([
                    {
                        entityId: 'breach-notified',
                        createdAt: fourDaysAgo,
                        metadata: JSON.stringify({ title: 'Notified breach' })
                    }
                ])
                .mockResolvedValueOnce([
                    { entityId: 'breach-notified', action: 'DATA_BREACH_AUTHORITY_NOTIFIED' }
                ]);

            const result = await checkOverdueBreachNotifications();

            expect(result.overdueCount).toBe(0);
            expect(result.incidents).toEqual([]);
        });

        it('uses fallback title when metadata has no title', async () => {
            const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

            (prisma.auditLog.findMany as any)
                .mockResolvedValueOnce([
                    {
                        entityId: 'breach-no-title',
                        createdAt: fourDaysAgo,
                        metadata: JSON.stringify({})
                    }
                ])
                .mockResolvedValueOnce([]);

            const result = await checkOverdueBreachNotifications();

            expect(result.incidents[0].title).toBe('(sin título)');
        });

        it('handles null metadata gracefully', async () => {
            const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

            (prisma.auditLog.findMany as any)
                .mockResolvedValueOnce([
                    {
                        entityId: 'breach-null-meta',
                        createdAt: fourDaysAgo,
                        metadata: null
                    }
                ])
                .mockResolvedValueOnce([]);

            const result = await checkOverdueBreachNotifications();

            expect(result.incidents[0].title).toBe('(sin título)');
        });

        it('caps results at 100 breaches', async () => {
            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
            const breaches = Array.from({ length: 100 }, (_, i) => ({
                entityId: `breach-${i}`,
                createdAt: threeDaysAgo,
                metadata: JSON.stringify({ title: `Breach ${i}` })
            }));

            (prisma.auditLog.findMany as any)
                .mockResolvedValueOnce(breaches)
                .mockResolvedValueOnce([]);

            const result = await checkOverdueBreachNotifications();

            expect(result.overdueCount).toBe(100);
            expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ take: 100 })
            );
        });
    });

    describe('BreachNotificationService (exported object)', () => {
        it('exposes all expected methods', () => {
            expect(BreachNotificationService.reportBreach).toBe(reportBreach);
            expect(BreachNotificationService.markAuthorityNotified).toBe(markAuthorityNotified);
            expect(BreachNotificationService.markSubjectsNotified).toBe(markSubjectsNotified);
            expect(BreachNotificationService.checkOverdueBreachNotifications).toBe(checkOverdueBreachNotifications);
        });
    });
});
