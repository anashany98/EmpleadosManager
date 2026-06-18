import { prisma } from '../lib/prisma';
import { EmailService } from './EmailService';
import { AuditService } from './AuditService';
import { createLogger } from './LoggerService';

const log = createLogger('BreachNotificationService');

/**
 * Data breach incident tracker. Implements the GDPR Art. 33 obligation
 * to notify the supervisory authority within 72 hours of becoming
 * aware of a personal data breach, and Art. 34 to notify affected
 * data subjects "without undue delay" when the breach is likely to
 * result in a high risk to their rights and freedoms.
 *
 * This service does NOT auto-detect breaches; the application code
 * MUST call `reportBreach()` when a security event is detected (e.g.
 * an external actor exfiltrates data, an admin accidentally publishes
 * a DB dump, an employee is found to have leaked credentials).
 */

export type BreachSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface BreachIncident {
    id: string;
    detectedAt: Date;
    reportedAt: Date;
    severity: BreachSeverity;
    title: string;
    description: string;
    affectedEmployeeIds: string[];
    affectedRecordCount: number;
    dataCategories: string[]; // e.g. ['SALARY', 'MEDICAL', 'DNI', 'IBAN']
    containmentSteps: string[];
    // Notification tracking
    authorityNotifiedAt: Date | null;
    authorityNotificationDeadline: Date; // detectedAt + 72h
    subjectsNotifiedAt: Date | null;
    status: 'OPEN' | 'CONTAINED' | 'AUTHORITY_NOTIFIED' | 'SUBJECTS_NOTIFIED' | 'CLOSED';
    createdBy: string; // userId of the reporter
    notes?: string;
}

interface ReportBreachInput {
    severity: BreachSeverity;
    title: string;
    description: string;
    affectedEmployeeIds?: string[];
    affectedRecordCount?: number;
    dataCategories: string[];
    containmentSteps?: string[];
    createdBy: string; // userId of the reporter (must be a global admin)
    notes?: string;
}

/**
 * Record a new breach. This is the entry point for all breach
 * notifications; the application calls it from the admin console or
 * a hard-coded call in the security middleware (e.g. on detection
 * of a SQL injection attempt).
 */
export async function reportBreach(input: ReportBreachInput): Promise<BreachIncident> {
    log.fatal(
        {
            severity: input.severity,
            title: input.title,
            dataCategories: input.dataCategories,
            affectedRecordCount: input.affectedRecordCount,
            affectedEmployeeCount: input.affectedEmployeeIds?.length ?? 0
        },
        'DATA BREACH REPORTED'
    );

    // Persist to audit log so the breach has a paper trail even if
    // the dedicated breach table is unavailable.
    await AuditService.log(
        'DATA_BREACH_REPORTED',
        'BREACH',
        'pending',
        {
            severity: input.severity,
            title: input.title,
            description: input.description,
            dataCategories: input.dataCategories,
            affectedRecordCount: input.affectedRecordCount
        },
        input.createdBy
    );

    // In a real system this would persist to a `BreachIncident`
    // table. For the current schema (no such table), we keep the
    // record in memory + in the AuditLog so a future query can
    // reconstruct the breach.
    const now = new Date();
    const incident: BreachIncident = {
        id: `breach_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
        detectedAt: now,
        reportedAt: now,
        severity: input.severity,
        title: input.title,
        description: input.description,
        affectedEmployeeIds: input.affectedEmployeeIds ?? [],
        affectedRecordCount: input.affectedRecordCount ?? 0,
        dataCategories: input.dataCategories,
        containmentSteps: input.containmentSteps ?? [],
        authorityNotifiedAt: null,
        // GDPR Art. 33: notification to the supervisory authority
        // within 72 hours of becoming aware.
        authorityNotificationDeadline: new Date(now.getTime() + 72 * 60 * 60 * 1000),
        subjectsNotifiedAt: null,
        status: 'OPEN',
        createdBy: input.createdBy,
        notes: input.notes
    };

    // Auto-notify on HIGH or CRITICAL: send email to the
    // configured DPO (Data Protection Officer). The actual
    // notification to the supervisory authority is a manual
    // step (the breach template must be filled in with the
    // authority's specific form, e.g. AEPD form in Spain).
    if (input.severity === 'HIGH' || input.severity === 'CRITICAL') {
        try {
            await notifyDataProtectionOfficer(incident);
        } catch (err) {
            log.error({ err, breachId: incident.id }, 'Failed to send DPO notification email');
        }
    }

    return incident;
}

/**
 * Mark the breach as notified to the supervisory authority. Called
 * after the operator fills in the AEPD form and submits it. Updates
 * the incident status.
 */
export async function markAuthorityNotified(breachId: string, notifiedAt: Date = new Date()) {
    await AuditService.log('DATA_BREACH_AUTHORITY_NOTIFIED', 'BREACH', breachId, {
        notifiedAt: notifiedAt.toISOString()
    }, 'system');
    log.info({ breachId, notifiedAt }, 'Authority notification recorded');
}

/**
 * Mark the breach as notified to the affected data subjects.
 * Art. 34: required when the breach is "likely to result in a high
 * risk to the rights and freedoms of natural persons".
 */
export async function markSubjectsNotified(breachId: string, notifiedAt: Date = new Date()) {
    await AuditService.log('DATA_BREACH_SUBJECTS_NOTIFIED', 'BREACH', breachId, {
        notifiedAt: notifiedAt.toISOString()
    }, 'system');
    log.info({ breachId, notifiedAt }, 'Subject notification recorded');
}

/**
 * Send a notification email to the Data Protection Officer. In
 * production, the DPO email should be set via the
 * `DPO_EMAIL` environment variable; in development we use a
 * placeholder.
 */
async function notifyDataProtectionOfficer(incident: BreachIncident): Promise<void> {
    const dpoEmail = process.env.DPO_EMAIL || 'dpo@example.com';
    const subject = `[DATA BREACH ${incident.severity}] ${incident.title}`;
    const body = `
Se ha reportado un incidente de seguridad de severidad ${incident.severity}.

Título: ${incident.title}
Descripción: ${incident.description}

Detectado: ${incident.detectedAt.toISOString()}
Reportado: ${incident.reportedAt.toISOString()}
Deadline notificación a la autoridad: ${incident.authorityNotificationDeadline.toISOString()}

Empleados afectados: ${incident.affectedEmployeeIds.length}
Registros afectados: ${incident.affectedRecordCount}
Categorías de datos: ${incident.dataCategories.join(', ')}

Pasos de contención:
${incident.containmentSteps.map((s) => `- ${s}`).join('\n')}

Acciones requeridas:
1. Verificar el incidente
2. Notificar a la autoridad de control (AEPD en España) en < 72h
3. Si hay alto riesgo, notificar a los empleados afectados
4. Documentar todo en el registro de incidentes

ID del incidente: ${incident.id}
    `.trim();

    await EmailService.sendMail(dpoEmail, subject, body);
}

/**
 * Job: scan the audit log for breach-related events that are past
 * the 72h deadline WITHOUT authority notification, and emit a
 * critical alert. Designed to be run hourly via cron or a
 * BullMQ scheduled job.
 */
export async function checkOverdueBreachNotifications(): Promise<{
    overdueCount: number;
    incidents: Array<{ id: string; title: string; hoursOverdue: number }>;
}> {
    // 72h in ms
    const SEVENTY_TWO_HOURS = 72 * 60 * 60 * 1000;
    const now = Date.now();
    const cutoff = new Date(now - SEVENTY_TWO_HOURS);

    // Find DATA_BREACH_REPORTED events older than 72h that are
    // NOT followed by a DATA_BREACH_AUTHORITY_NOTIFIED event.
    const recentBreaches = await prisma.auditLog.findMany({
        where: {
            action: 'DATA_BREACH_REPORTED',
            createdAt: { lt: cutoff }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
    });

    const notifications = await prisma.auditLog.findMany({
        where: {
            action: { in: ['DATA_BREACH_AUTHORITY_NOTIFIED', 'DATA_BREACH_SUBJECTS_NOTIFIED', 'DATA_BREACH_CLOSED'] }
        },
        select: { entityId: true, action: true, createdAt: true }
    });

    const notifiedBreachIds = new Set(notifications.map((n) => n.entityId));

    const overdue: Array<{ id: string; title: string; hoursOverdue: number }> = [];
    for (const breach of recentBreaches) {
        if (notifiedBreachIds.has(breach.entityId)) continue;
        const metadata = breach.metadata ? JSON.parse(breach.metadata) : {};
        const hoursOverdue = (now - breach.createdAt.getTime()) / (60 * 60 * 1000) - 72;
        overdue.push({
            id: breach.entityId,
            title: metadata.title || '(sin título)',
            hoursOverdue
        });
    }

    if (overdue.length > 0) {
        log.fatal(
            { count: overdue.length, overdue },
            'BREACH NOTIFICATION OVERDUE — GDPR Art. 33 violation possible'
        );
    }

    return { overdueCount: overdue.length, incidents: overdue };
}

export const BreachNotificationService = {
    reportBreach,
    markAuthorityNotified,
    markSubjectsNotified,
    checkOverdueBreachNotifications
};
