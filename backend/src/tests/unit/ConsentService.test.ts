import { describe, it, expect, vi, beforeEach } from 'vitest';

// Factories (no top-level state) so vi.mock can hoist them safely.
vi.mock('../../lib/prisma', () => {
    const mockConsent = {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        delete: vi.fn()
    };
    return {
        prisma: { consent: mockConsent }
    };
});

vi.mock('../../services/AuditService', () => ({
    AuditService: {
        log: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('../../services/LoggerService', () => ({
    createLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    })
}));

import { ConsentService, CONSENT_PURPOSES } from '../../services/ConsentService';
import { prisma } from '../../lib/prisma';
import { AuditService } from '../../services/AuditService';

beforeEach(() => {
    vi.clearAllMocks();
});

describe('ConsentService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('recordConsent: persists a granted consent with granted=true', async () => {
        const fake = { id: 'c-1', purpose: CONSENT_PURPOSES.MARKETING_COMMUNICATIONS, granted: true };
        (prisma.consent.create as any).mockResolvedValue(fake);

        const result = await ConsentService.recordConsent(
            'emp-1',
            CONSENT_PURPOSES.MARKETING_COMMUNICATIONS,
            { ipAddress: '1.2.3.4', policyVersion: '1.0.0' },
            { id: 'user-1', role: 'employee' }
        );

        expect(result).toEqual(fake);
        expect(prisma.consent.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    employeeId: 'emp-1',
                    purpose: CONSENT_PURPOSES.MARKETING_COMMUNICATIONS,
                    granted: true,
                    policyVersion: '1.0.0',
                    ipAddress: '1.2.3.4'
                })
            })
        );
    });

    it('recordConsent: defaults to granted=true when not specified', async () => {
        (prisma.consent.create as any).mockResolvedValue({ id: 'c-1', granted: true });

        await ConsentService.recordConsent('emp-1', CONSENT_PURPOSES.LOCATION_TRACKING, {}, { id: 'u', role: 'e' });

        expect(prisma.consent.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ granted: true })
            })
        );
    });

    it('recordConsent: supports withdrawal (granted=false)', async () => {
        (prisma.consent.create as any).mockResolvedValue({ id: 'c-2', granted: false });

        await ConsentService.recordConsent(
            'emp-1',
            CONSENT_PURPOSES.MARKETING_COMMUNICATIONS,
            { granted: false },
            { id: 'u', role: 'e' }
        );

        expect(prisma.consent.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ granted: false })
            })
        );
    });

    it('recordConsent: rejects unknown purpose', async () => {
        await expect(
            ConsentService.recordConsent('emp-1', 'UNKNOWN_PURPOSE', {}, { id: 'u', role: 'e' })
        ).rejects.toThrow(/Unknown consent purpose/);
        expect(prisma.consent.create).not.toHaveBeenCalled();
    });

    it('recordConsent: writes an audit log entry on every record', async () => {
        (prisma.consent.create as any).mockResolvedValue({ id: 'c-3' });

        await ConsentService.recordConsent('emp-1', CONSENT_PURPOSES.MARKETING_COMMUNICATIONS, {}, { id: 'audit-actor', role: 'admin' });

        expect(AuditService.log).toHaveBeenCalledWith(
            'GRANT_CONSENT',
            'CONSENT',
            'c-3',
            expect.objectContaining({
                employeeId: 'emp-1',
                purpose: CONSENT_PURPOSES.MARKETING_COMMUNICATIONS,
                specialCategory: false
            }),
            'audit-actor'
        );
    });

    it('recordConsent: marks special-category consents (Art. 9) in the audit log', async () => {
        (prisma.consent.create as any).mockResolvedValue({ id: 'c-4' });

        await ConsentService.recordConsent('emp-1', CONSENT_PURPOSES.MEDICAL_DATA_PROCESSING, {}, { id: 'u', role: 'e' });

        expect(AuditService.log).toHaveBeenCalledWith(
            'GRANT_CONSENT',
            'CONSENT',
            'c-4',
            expect.objectContaining({ specialCategory: true }),
            'u'
        );
    });

    it('isConsentActive: returns true when latest record is granted', async () => {
        (prisma.consent.findFirst as any).mockResolvedValue({
            purpose: CONSENT_PURPOSES.MARKETING_COMMUNICATIONS,
            granted: true
        });
        expect(await ConsentService.isConsentActive('emp-1', CONSENT_PURPOSES.MARKETING_COMMUNICATIONS)).toBe(true);
    });

    it('isConsentActive: returns false when latest record is a withdrawal', async () => {
        (prisma.consent.findFirst as any).mockResolvedValue({
            purpose: CONSENT_PURPOSES.MARKETING_COMMUNICATIONS,
            granted: false
        });
        expect(await ConsentService.isConsentActive('emp-1', CONSENT_PURPOSES.MARKETING_COMMUNICATIONS)).toBe(false);
    });

    it('isConsentActive: returns false when no record exists', async () => {
        (prisma.consent.findFirst as any).mockResolvedValue(null);
        expect(await ConsentService.isConsentActive('emp-1', CONSENT_PURPOSES.MARKETING_COMMUNICATIONS)).toBe(false);
    });

    it('getConsentStatusByPurpose: returns one record per purpose, the most recent', async () => {
        // Two records per purpose (a grant and a withdrawal); the
        // helper must return the latest one.
        (prisma.consent.findMany as any).mockResolvedValue([
            { purpose: 'A', granted: true, grantedAt: new Date('2026-01-01'), withdrawnAt: null, policyVersion: '1.0', id: '1' },
            { purpose: 'A', granted: false, grantedAt: new Date('2026-02-01'), withdrawnAt: new Date('2026-02-01'), policyVersion: '1.0', id: '2' },
            { purpose: 'B', granted: true, grantedAt: new Date('2026-01-15'), withdrawnAt: null, policyVersion: '1.0', id: '3' }
        ]);

        const result = await ConsentService.getConsentStatusByPurpose('emp-1');

        expect(result).toHaveLength(2);
        const a = result.find((r) => r.purpose === 'A');
        const b = result.find((r) => r.purpose === 'B');
        expect(a?.granted).toBe(false);
        expect(a?.withdrawnAt).toEqual(new Date('2026-02-01'));
        expect(b?.granted).toBe(true);
    });

    it('getConsentStatusByPurpose: flags special categories', async () => {
        (prisma.consent.findMany as any).mockResolvedValue([
            { purpose: CONSENT_PURPOSES.MEDICAL_DATA_PROCESSING, granted: true, grantedAt: new Date(), policyVersion: '1.0', id: '1' },
            { purpose: CONSENT_PURPOSES.MARKETING_COMMUNICATIONS, granted: true, grantedAt: new Date(), policyVersion: '1.0', id: '2' }
        ]);

        const result = await ConsentService.getConsentStatusByPurpose('emp-1');
        const medical = result.find((r) => r.purpose === CONSENT_PURPOSES.MEDICAL_DATA_PROCESSING);
        const marketing = result.find((r) => r.purpose === CONSENT_PURPOSES.MARKETING_COMMUNICATIONS);
        expect(medical?.specialCategory).toBe(true);
        expect(marketing?.specialCategory).toBe(false);
    });
});
