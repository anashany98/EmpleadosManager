import { prisma } from '../lib/prisma';
import { createLogger } from './LoggerService';

const log = createLogger('AuditService');

/**
 * Internal helper: persist an audit log entry, with up to 3 retries on
 * transient errors. Errors are logged with the structured logger but
 * never thrown, since audit failures must not break the caller's
 * business flow. If the log still cannot be written, the metadata is
 * emitted as a log entry at `fatal` level so the information is at
 * least shipped to the log aggregator (and Sentry via log forwarding).
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

    // All retries failed: log to structured logger and as fatal so Sentry
    // captures it. The audit data is included so it can be reconstructed
    // by an operator if needed.
    log.fatal(
        {
            err: lastError,
            auditData: data,
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
