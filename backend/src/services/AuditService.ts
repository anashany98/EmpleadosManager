import { prisma } from '../lib/prisma';

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
        targetEmployeeId?: string
    ) {
        try {
            await prisma.auditLog.create({
                data: {
                    action,
                    entity,
                    entityId,
                    metadata: metadata ? JSON.stringify(metadata) : null,
                    userId,
                    targetEmployeeId
                }
            });
        } catch (error) {
            console.error('Error logging audit:', error);
        }
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
        try {
            await prisma.auditLog.create({
                data: {
                    action,
                    entity,
                    entityId,
                    metadata: context.metadata ? JSON.stringify(context.metadata) : null,
                    userId: context.userId,
                    targetEmployeeId: context.targetEmployeeId
                }
            });
        } catch (error) {
            console.error('Error logging audit with context:', error);
        }
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
        try {
            await prisma.auditLog.create({
                data: {
                    action,
                    entity: AuditEntity.USER,
                    entityId: details.userId || 'unknown',
                    metadata: JSON.stringify({
                        ...details.metadata,
                        reason: details.reason,
                        ipAddress: details.ipAddress,
                        userAgent: details.userAgent
                    }),
                    userId: details.userId
                }
            });
        } catch (error) {
            console.error('Error logging security event:', error);
        }
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