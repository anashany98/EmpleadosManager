import { prisma } from '../lib/prisma';
import { createLogger } from './LoggerService';

const log = createLogger('AuditService');

/**
 * Redacción del payload de auditoría antes de emitirlo a un agregador de
 * logs (Pino/Sentry/Elasticsearch).
 *
 * La metadata de auditoría puede contener PII (nombres, DNIs, salarios,
 * coordenadas GPS de fichajes, hashes de contraseña, etc.) según qué
 * controller llamó. Si el insert en `auditLog` falla tras los reintentos,
 * el camino viejo metía el `data` entero en `log.fatal({ auditData: data })`,
 * lo que filtraba esa PII al log aggregator — que en este proyecto reenvía
 * a Sentry.
 *
 * Esta función produce un objeto seguro para enviar a un log remoto:
 *   - mantiene tipo de acción y entidad (útiles para alertas/alarms),
 *   - trunca los ids a sus primeros 8 chars (suficiente para correlacionar
 *     con el id completo en los logs locales, no para reconstruir el uuid),
 *   - reporta tamaño y nombres de claves del metadata pero NUNCA los valores,
 *   - omite `ipAddress` y `userAgent` (GDPR: datos personales identificables).
 *
 * El operador aún puede reconstruir el evento porque el `metadata` completo
 * está en la base de datos si el insert fue exitoso; este scrubbing solo
 * aplica a la rama de fallo donde no hay registro y recurrimos al log.
 */
function scrubAuditDataForLog(
    data: Parameters<typeof prisma.auditLog.create>[0]['data']
): {
    action: unknown;
    entity: unknown;
    entityIdPrefix: string | null;
    userIdPrefix: string | null;
    targetEmployeeIdPrefix: string | null;
    metadataBytes: number;
    metadataKeys: string[];
} {
    const truncate = (s: unknown): string | null => {
        if (typeof s !== 'string' || s.length === 0) return null;
        return s.length <= 8 ? s : `${s.slice(0, 8)}…`;
    };

    let metadataBytes = 0;
    let metadataKeys: string[] = [];
    const rawMetadata = data.metadata;
    if (typeof rawMetadata === 'string' && rawMetadata.length > 0) {
        metadataBytes = Buffer.byteLength(rawMetadata, 'utf8');
        try {
            const parsed = JSON.parse(rawMetadata);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                // Solo nombres, nunca valores. Tope de 50 por si alguien
                // metió un payload gigante con miles de claves.
                metadataKeys = Object.keys(parsed).slice(0, 50);
            }
        } catch {
            // Si no parsea, no exponemos nada — solo el tamaño en bytes.
        }
    }

    return {
        action: data.action,
        entity: data.entity,
        entityIdPrefix: truncate(data.entityId),
        userIdPrefix: truncate(data.userId),
        targetEmployeeIdPrefix: truncate(data.targetEmployeeId),
        metadataBytes,
        metadataKeys
    };
}

/**
 * Internal helper: persist an audit log entry, with up to 3 retries on
 * transient errors. Errors are logged with the structured logger but
 * never thrown, since audit failures must not break the caller's
 * business flow. If the log still cannot be written, a SCRUBBED summary
 * is emitted as a `fatal` log entry so the information is shipped to the
 * log aggregator (and Sentry via log forwarding) WITHOUT leaking PII.
 */
async function persistAuditEntry(
    data: Parameters<typeof prisma.auditLog.create>[0]['data'],
    maxRetries = 3
): Promise<void> {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await prisma.auditLog.create({ data });
            return;
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                // Exponential backoff: 100, 200, 400 ms
                const delay = 100 * Math.pow(2, attempt - 1);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    // All retries failed: log a scrubbed summary so Sentry captures an
    // alert without leaking PII. The full payload is NOT included.
    log.fatal(
        {
            err: lastError,
            auditMeta: scrubAuditDataForLog(data),
            message: 'Audit log write failed after retries. The action was NOT audited in DB.'
        },
        'AUDIT_WRITE_FAILURE'
    );
}

export enum AuditAction {
    LOGIN = 'LOGIN',
    LOGIN_FAILED = 'LOGIN_FAILED',
    LOGOUT = 'LOGOUT',
    PASSWORD_CHANGE = 'PASSWORD_CHANGE',
    PASSWORD_RESET = 'PASSWORD_RESET',
    PERMISSION_CHANGE = 'PERMISSION_CHANGE',
    DATA_CREATE = 'DATA_CREATE',
    DATA_UPDATE = 'DATA_UPDATE',
    DATA_DELETE = 'DATA_DELETE',
    DATA_EXPORT = 'DATA_EXPORT',
    ACCESS_DENIED = 'ACCESS_DENIED',
    FILE_UPLOAD = 'FILE_UPLOAD',
    FILE_DELETE = 'FILE_DELETE',
    SECURITY_VIOLATION = 'SECURITY_VIOLATION',
    GESTORIA_PERIOD_CLOSE = 'GESTORIA_PERIOD_CLOSE',
    GESTORIA_PERIOD_REOPEN = 'GESTORIA_PERIOD_REOPEN',
    GESTORIA_EXPORT = 'GESTORIA_EXPORT',
    GESTORIA_DOWNLOAD = 'GESTORIA_DOWNLOAD',
}

export enum AuditEntity {
    USER = 'USER',
    EMPLOYEE = 'EMPLOYEE',
    VACATION = 'VACATION',
    EXPENSE = 'EXPENSE',
    DOCUMENT = 'DOCUMENT',
    PAYROLL = 'PAYROLL',
    TIMEOFFICE = 'TIMEOFFICE',
    COMPANY = 'COMPANY',
    GESTORIA = 'GESTORIA',
}

export interface AuditLogEntry {
    id?: string;
    action: AuditAction;
    entity: AuditEntity;
    entityId: string;
    metadata?: Record<string, any>;
    userId?: string;
    targetEmployeeId?: string;
    ipAddress?: string;
    userAgent?: string;
    createdAt?: Date;
}

export class AuditService {
    static async log(
        action: string | AuditAction,
        entity: string | AuditEntity,
        entityId: string,
        metadata?: Record<string, any>,
        userId?: string,
        targetEmployeeId?: string,
        ipAddress?: string,
        userAgent?: string
    ) {
        await persistAuditEntry({
            action,
            entity,
            entityId,
            metadata: metadata ? JSON.stringify(metadata) : null,
            userId,
            targetEmployeeId,
            ipAddress: ipAddress || null,
            userAgent: userAgent || null
        });
    }

    static async logWithContext(
        action: string | AuditAction,
        entity: string | AuditEntity,
        entityId: string,
        context: {
            userId?: string;
            targetEmployeeId?: string;
            ipAddress?: string;
            userAgent?: string;
            metadata?: Record<string, any>;
        }
    ) {
        await persistAuditEntry({
            action,
            entity,
            entityId,
            metadata: context.metadata ? JSON.stringify(context.metadata) : null,
            userId: context.userId,
            targetEmployeeId: context.targetEmployeeId,
            ipAddress: context.ipAddress || null,
            userAgent: context.userAgent || null
        });
    }

    static async logSecurityEvent(
        action: AuditAction,
        details: {
            reason: string;
            ipAddress?: string;
            userAgent?: string;
            userId?: string;
            metadata?: Record<string, any>;
        }
    ) {
        await persistAuditEntry({
            action,
            entity: AuditEntity.USER,
            entityId: details.userId || 'unknown',
            metadata: JSON.stringify({
                ...details.metadata,
                reason: details.reason
            }),
            userId: details.userId,
            ipAddress: details.ipAddress || null,
            userAgent: details.userAgent || null
        });
    }

    static async logLoginSuccess(userId: string, ipAddress?: string, userAgent?: string) {
        await AuditService.logSecurityEvent(AuditAction.LOGIN, {
            reason: 'Successful login',
            ipAddress,
            userAgent,
            userId
        });
    }

    static async logLoginFailed(
        identifier: string,
        reason: string,
        ipAddress?: string,
        userAgent?: string
    ) {
        await AuditService.logSecurityEvent(AuditAction.LOGIN_FAILED, {
            reason,
            ipAddress,
            userAgent,
            metadata: { identifier }
        });
    }

    static async logAccessDenied(
        userId: string,
        resource: string,
        reason: string,
        ipAddress?: string
    ) {
        await AuditService.logSecurityEvent(AuditAction.ACCESS_DENIED, {
            reason,
            ipAddress,
            userId,
            metadata: { resource, reason }
        });
    }

    static async getLogs(
        options: {
            entity?: string;
            entityId?: string;
            userId?: string;
            action?: string;
            startDate?: Date;
            endDate?: Date;
        } = {},
        pagination: { page?: number; limit?: number } = { page: 1, limit: 100 }
    ) {
        const { page = 1, limit = 100 } = pagination;
        const skip = (page - 1) * limit;

        const where: Record<string, any> = {};

        if (options.entity) where.entity = options.entity;
        if (options.entityId) where.entityId = options.entityId;
        if (options.userId) where.userId = options.userId;
        if (options.action) where.action = options.action;

        if (options.startDate || options.endDate) {
            where.createdAt = {};
            if (options.startDate) where.createdAt.gte = options.startDate;
            if (options.endDate) where.createdAt.lte = options.endDate;
        }

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: { user: true }
            }),
            prisma.auditLog.count({ where })
        ]);

        return {
            logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    static async getSecurityLogs(
        options?: { startDate?: Date; endDate?: Date },
        pagination?: { page?: number; limit?: number }
    ) {
        const safeOptions = options || {};
        const safePagination = pagination || { page: 1, limit: 50 };
        const securityActions = [
            AuditAction.LOGIN,
            AuditAction.LOGIN_FAILED,
            AuditAction.LOGOUT,
            AuditAction.SECURITY_VIOLATION,
            AuditAction.ACCESS_DENIED
        ];

        const { page = 1, limit = 50 } = safePagination;
        const skip = (page - 1) * limit;

        const where: Record<string, any> = {
            action: { in: securityActions }
        };

        if (safeOptions.startDate || safeOptions.endDate) {
            where.createdAt = {};
            if (safeOptions.startDate) where.createdAt.gte = safeOptions.startDate;
            if (safeOptions.endDate) where.createdAt.lte = safeOptions.endDate;
        }

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: { user: true }
            }),
            prisma.auditLog.count({ where })
        ]);

        return {
            logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
}
