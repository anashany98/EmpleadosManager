import { prisma } from '../lib/prisma';
import { AuditService } from './AuditService';
import { AppError } from '../utils/AppError';
import { createLogger } from './LoggerService';

const log = createLogger('ConsentService');

/**
 * Known consent purposes. The schema's `purpose` column is `String`
 * (free-text) to allow adding new purposes without a migration, but
 * the application should restrict writes to this enum.
 *
 * Categories marked as "SPECIAL_CATEGORY" require explicit consent
 * under GDPR Art. 9 (sensitive data: health, biometric, etc).
 */
export const CONSENT_PURPOSES = {
    MEDICAL_DATA_PROCESSING: 'MEDICAL_DATA_PROCESSING', // GDPR Art. 9
    BIOMETRIC_AUTH: 'BIOMETRIC_AUTH', // GDPR Art. 9 (face/fingerprint)
    MARKETING_COMMUNICATIONS: 'MARKETING_COMMUNICATIONS',
    THIRD_PARTY_DATA_SHARING: 'THIRD_PARTY_DATA_SHARING',
    BACKGROUND_CHECKS: 'BACKGROUND_CHECKS', // pre-employment, not strictly Art. 9
    LOCATION_TRACKING: 'LOCATION_TRACKING', // geofencing
    AUTOMATED_DECISION_MAKING: 'AUTOMATED_DECISION_MAKING' // GDPR Art. 22
} as const;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[keyof typeof CONSENT_PURPOSES];

const SPECIAL_CATEGORY_PURPOSES = new Set<string>([
    CONSENT_PURPOSES.MEDICAL_DATA_PROCESSING,
    CONSENT_PURPOSES.BIOMETRIC_AUTH
]);

/**
 * Record a new consent. The record is immutable: a withdrawal is a
 * new row with `granted: false` and `withdrawnAt: now`, NOT an
 * update. This gives a full audit trail per GDPR Art. 7(1).
 */
export async function recordConsent(
    employeeId: string,
    purpose: string,
    options: {
        granted?: boolean;
        ipAddress?: string;
        userAgent?: string;
        policyVersion?: string;
        notes?: string;
        legalBasis?: string;
    } = {},
    actor: { id: string; role: string }
) {
    if (!Object.values(CONSENT_PURPOSES).includes(purpose as ConsentPurpose)) {
        throw new AppError(`Unknown consent purpose: ${purpose}`, 400);
    }

    const granted = options.granted ?? true;

    // Special categories (Art. 9) require explicit consent. We do not
    // enforce the "explicit" verification at the application level
    // (that is a UI/UX concern — the user must tick a separate box),
    // but we log it so the audit trail is complete.
    if (SPECIAL_CATEGORY_PURPOSES.has(purpose) && !granted) {
        log.info(
            { employeeId, purpose, actorId: actor.id },
            'Special-category consent withdrawn (Art. 9 GDPR)'
        );
    }

    const consent = await prisma.consent.create({
        data: {
            employeeId,
            purpose,
            granted,
            ipAddress: options.ipAddress,
            userAgent: options.userAgent,
            policyVersion: options.policyVersion ?? '1.0.0',
            notes: options.notes,
            legalBasis: options.legalBasis ?? 'CONSENT'
        }
    });

    await AuditService.log(
        granted ? 'GRANT_CONSENT' : 'WITHDRAW_CONSENT',
        'CONSENT',
        consent.id,
        {
            employeeId,
            purpose,
            specialCategory: SPECIAL_CATEGORY_PURPOSES.has(purpose)
        },
        actor.id
    );

    return consent;
}

/**
 * Get the latest consent record for a (employee, purpose) pair.
 * Returns `null` if no consent was ever recorded.
 */
export async function getLatestConsent(employeeId: string, purpose: string) {
    return prisma.consent.findFirst({
        where: { employeeId, purpose },
        orderBy: { grantedAt: 'desc' }
    });
}

/**
 * Convenience: is the consent currently active (granted AND not
 * superseded by a later withdrawal)?
 */
export async function isConsentActive(employeeId: string, purpose: ConsentPurpose): Promise<boolean> {
    const latest = await getLatestConsent(employeeId, purpose);
    if (!latest) return false;
    return latest.granted;
}

/**
 * List ALL consent records for an employee (right of access, GDPR
 * Art. 15). Includes withdrawals and grants.
 */
export async function listConsentsForEmployee(employeeId: string) {
    return prisma.consent.findMany({
        where: { employeeId },
        orderBy: [{ purpose: 'asc' }, { grantedAt: 'desc' }]
    });
}

/**
 * Convenience: get the latest status (granted/withdrawn) per purpose
 * for an employee. Returns one record per purpose (the most recent).
 */
export async function getConsentStatusByPurpose(employeeId: string) {
    const all = await listConsentsForEmployee(employeeId);
    const byPurpose = new Map<string, typeof all[number]>();
    for (const c of all) {
        const existing = byPurpose.get(c.purpose);
        if (!existing || existing.grantedAt < c.grantedAt) {
            byPurpose.set(c.purpose, c);
        }
    }
    return Array.from(byPurpose.values()).map((c) => ({
        purpose: c.purpose,
        granted: c.granted,
        grantedAt: c.grantedAt,
        withdrawnAt: c.withdrawnAt,
        policyVersion: c.policyVersion,
        specialCategory: SPECIAL_CATEGORY_PURPOSES.has(c.purpose)
    }));
}

export const ConsentService = {
    CONSENT_PURPOSES,
    recordConsent,
    getLatestConsent,
    isConsentActive,
    listConsentsForEmployee,
    getConsentStatusByPurpose
};
