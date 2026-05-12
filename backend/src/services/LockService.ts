import { redis } from '../config/redis';
import { prisma } from '../lib/prisma';
import { createLogger } from './LoggerService';
import {
    LockAction,
    LockData,
    LockInfo,
    LockResult,
    LOCK_CONFIG
} from '../interfaces/lock.types';
import { AuthUser } from '../types/express';

const log = createLogger('LockService');

export class LockService {
    private getLockKey(employeeId: string): string {
        return `${LOCK_CONFIG.KEY_PREFIX}${employeeId}`;
    }

    async acquire(employeeId: string, user: AuthUser): Promise<LockResult> {
        const lockKey = this.getLockKey(employeeId);

        const existing = await this.getLockInfo(employeeId);
        if (existing.isLocked && existing.lock?.userId !== user.id) {
            return { success: false, conflict: existing };
        }

        if (existing.isLocked && existing.lock?.userId === user.id) {
            return this.refresh(employeeId, user);
        }

        const lockData: LockData = {
            userId: user.id,
            userEmail: user.email,
            userName: user.name || user.email,
            timestamp: Date.now(),
            expiresAt: Date.now() + LOCK_CONFIG.TTL_SECONDS * 1000,
            pageUrl: `/employees/${employeeId}`
        };

        const acquired = await redis.set(
            lockKey,
            JSON.stringify(lockData),
            'EX',
            LOCK_CONFIG.TTL_SECONDS,
            'NX'
        );

        if (!acquired) {
            const currentLock = await this.getLock(employeeId);
            const now = Date.now();
            return {
                success: false,
                conflict: {
                    isLocked: true,
                    lock: currentLock.lock,
                    isOwner: false,
                    timeRemaining: currentLock.lock?.expiresAt ? currentLock.lock.expiresAt - now : null
                }
            };
        }

        await this.auditLog(employeeId, user.id, user.email, user.name || '', LockAction.ACQUIRED);
        return { success: true, lock: lockData };
    }

    async release(employeeId: string, user: AuthUser): Promise<boolean> {
        const lockKey = this.getLockKey(employeeId);
        const current = await this.getLock(employeeId);

        if (!current.lock) {
            return true;
        }

        if (current.lock.userId !== user.id) {
            throw new Error('NOT_LOCK_OWNER');
        }

        await redis.del(lockKey);
        await this.auditLog(employeeId, user.id, user.email, user.name || '', LockAction.RELEASED);
        return true;
    }

    async refresh(employeeId: string, user: AuthUser): Promise<LockResult> {
        const lockKey = this.getLockKey(employeeId);
        const current = await this.getLock(employeeId);

        if (!current.lock || current.lock.userId !== user.id) {
            return { success: false, error: 'NOT_LOCK_OWNER' };
        }

        const refreshedLock = {
            ...current.lock,
            timestamp: Date.now(),
            expiresAt: Date.now() + LOCK_CONFIG.TTL_SECONDS * 1000,
        };
        const refreshed = await redis.set(
            lockKey,
            JSON.stringify(refreshedLock),
            'EX',
            LOCK_CONFIG.TTL_SECONDS,
            'XX'
        );

        if (!refreshed) {
            return { success: false, error: 'REFRESH_FAILED' };
        }

        await this.auditLog(employeeId, user.id, user.email, user.name || '', LockAction.REFRESHED);
        return { success: true, lock: refreshedLock };
    }

    async forceRelease(employeeId: string, adminUser: AuthUser, reason?: string): Promise<void> {
        if (adminUser.role !== 'admin') {
            throw new Error('ADMIN_REQUIRED');
        }

        const lockKey = this.getLockKey(employeeId);
        const current = await this.getLock(employeeId);

        if (current.lock) {
            await redis.del(lockKey);
            await this.auditLog(
                employeeId,
                adminUser.id,
                adminUser.email,
                adminUser.name || '',
                LockAction.FORCE_RELEASED,
                { reason: reason || 'Admin force release' }
            );
        }
    }

    async getLockInfo(employeeId: string, requesterId?: string): Promise<LockInfo> {
        const lock = await this.getLock(employeeId);
        const now = Date.now();

        if (!lock.lock || (lock.lock.expiresAt && lock.lock.expiresAt < now)) {
            return {
                isLocked: false,
                lock: null,
                isOwner: false,
                timeRemaining: null
            };
        }

        return {
            isLocked: true,
            lock: lock.lock,
            isOwner: requesterId ? lock.lock.userId === requesterId : false,
            timeRemaining: lock.lock.expiresAt ? lock.lock.expiresAt - now : null
        };
    }

    private async getLock(employeeId: string): Promise<{ lock: LockData | null }> {
        const lockKey = this.getLockKey(employeeId);
        const data = await redis.get(lockKey);

        if (!data) {
            return { lock: null };
        }

        try {
            return { lock: JSON.parse(data) as LockData };
        } catch {
            return { lock: null };
        }
    }

    private async auditLog(
        employeeId: string,
        userId: string,
        userEmail: string,
        userName: string,
        action: LockAction,
        metadata?: Record<string, any>
    ): Promise<void> {
        try {
            await prisma.employeeLockAudit.create({
                data: {
                    employeeId,
                    userId,
                    userEmail,
                    userName,
                    action,
                    metadata: metadata ? JSON.stringify(metadata) : undefined
                }
            });
        } catch (error) {
            log.error({ error, employeeId, action }, 'Failed to log lock audit');
        }
    }
}

export const lockService = new LockService();