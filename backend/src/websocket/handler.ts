import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { lockService } from '../services/LockService';
import {
    broadcastToEmployeeRoom,
    joinEmployeeRoom,
    leaveEmployeeRoom
} from './rooms';
import { AuthUser } from '../types/express';
import { LockInfo } from '../interfaces/lock.types';

if (!process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is required for WebSocket authentication');
}
const JWT_SECRET = process.env.JWT_SECRET;

type LockSocketPayload = string | number | {
    resourceId?: string | number;
    resourceType?: string;
    employeeId?: string | number;
};

type NormalizedLockPayload = {
    employeeId: string;
    resourceId: string;
    resourceType: string;
};

export function getSocketAccessToken(socket: Pick<Socket, 'handshake'>): string | null {
    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
        return authToken;
    }

    const cookieHeader = socket.handshake.headers?.cookie;
    if (typeof cookieHeader !== 'string') {
        return null;
    }

    const accessCookie = cookieHeader
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('access_token='));

    if (!accessCookie) {
        return null;
    }

    return decodeURIComponent(accessCookie.slice('access_token='.length));
}

export function normalizeLockPayload(payload: LockSocketPayload): NormalizedLockPayload | null {
    if (typeof payload === 'string' || typeof payload === 'number') {
        const employeeId = String(payload).trim();
        return employeeId ? { employeeId, resourceId: employeeId, resourceType: 'employee' } : null;
    }

    if (!payload || typeof payload !== 'object') {
        return null;
    }

    const resourceType = typeof payload.resourceType === 'string' && payload.resourceType.trim()
        ? payload.resourceType.trim()
        : 'employee';
    const resourceIdValue = payload.resourceId ?? payload.employeeId;
    if (resourceIdValue === undefined || resourceIdValue === null) {
        return null;
    }

    const resourceId = String(resourceIdValue).trim();
    const employeeId = String(payload.employeeId ?? resourceId).trim();

    if (!resourceId || !employeeId) {
        return null;
    }

    return { employeeId, resourceId, resourceType };
}

async function authenticateSocket(socket: Socket): Promise<AuthUser | null> {
    const token = getSocketAccessToken(socket);

    if (!token) {
        return null;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string; sessionVersion?: number };

        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                email: true,
                role: true,
                permissions: true,
                employeeId: true,
                isActive: true,
                sessionVersion: true,
                employee: { select: { companyId: true } }
            }
        });

        if (!user || !user.isActive) {
            return null;
        }

        if (typeof decoded.sessionVersion === 'number' && user.sessionVersion !== decoded.sessionVersion) {
            return null;
        }

        let parsedPermissions: Record<string, any> = {};
        try {
            parsedPermissions = user.permissions ? JSON.parse(user.permissions as string) : {};
        } catch {
            parsedPermissions = {};
        }

        return {
            id: user.id,
            email: user.email,
            role: user.role as any,
            employeeId: user.employeeId || undefined,
            companyId: user.employee?.companyId || undefined,
            permissions: parsedPermissions
        };
    } catch {
        return null;
    }
}

export function initSocketHandlers(io: Server): void {
    io.use(async (socket: Socket, next) => {
        const user = await authenticateSocket(socket);
        if (user) {
            (socket as any).user = user;
            next();
        } else {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket: Socket) => {
        const user = (socket as any).user as AuthUser;

        socket.on('lock:acquire', async (payload: LockSocketPayload) => {
            const lockPayload = normalizeLockPayload(payload);
            if (!lockPayload) {
                socket.emit('lock:error', { error: 'INVALID_LOCK_PAYLOAD' });
                return;
            }

            try {
                const result = await lockService.acquire(lockPayload.employeeId, user);

                if (result.success && result.lock) {
                    const eventPayload = {
                        employeeId: lockPayload.employeeId,
                        resourceId: lockPayload.resourceId,
                        resourceType: lockPayload.resourceType,
                        employeeName: result.lock.userName,
                        acquiredAt: new Date(result.lock.timestamp).toISOString(),
                        expiresAt: new Date(result.lock.expiresAt).toISOString(),
                    };
                    broadcastToEmployeeRoom(io, lockPayload.employeeId, 'lock:acquired', eventPayload);
                } else if (result.conflict) {
                    const eventPayload = {
                        employeeId: lockPayload.employeeId,
                        resourceId: lockPayload.resourceId,
                        resourceType: lockPayload.resourceType,
                        reason: 'LOCK_HELD',
                        currentHolder: {
                            id: result.conflict.lock?.userId,
                            name: result.conflict.lock?.userName,
                        },
                    };
                    socket.emit('lock:attempt:failed', eventPayload);
                }
            } catch {
                socket.emit('lock:error', { ...lockPayload, error: 'Failed to acquire lock' });
            }
        });

        socket.on('lock:release', async (payload: LockSocketPayload) => {
            const lockPayload = normalizeLockPayload(payload);
            if (!lockPayload) {
                socket.emit('lock:error', { error: 'INVALID_LOCK_PAYLOAD' });
                return;
            }

            try {
                await lockService.release(lockPayload.employeeId, user);

                const eventPayload = {
                    employeeId: lockPayload.employeeId,
                    resourceId: lockPayload.resourceId,
                    resourceType: lockPayload.resourceType,
                };
                broadcastToEmployeeRoom(io, lockPayload.employeeId, 'lock:released', eventPayload);
            } catch (error) {
                if ((error as Error).message === 'NOT_LOCK_OWNER') {
                    socket.emit('lock:error', { ...lockPayload, error: 'NOT_LOCK_OWNER' });
                } else {
                    socket.emit('lock:error', { ...lockPayload, error: 'Failed to release lock' });
                }
            }
        });

        const handleLockRefresh = async (payload: LockSocketPayload) => {
            const lockPayload = normalizeLockPayload(payload);
            if (!lockPayload) {
                socket.emit('lock:heartbeat:ack', { success: false, error: 'INVALID_LOCK_PAYLOAD' });
                return;
            }

            try {
                const result = await lockService.refresh(lockPayload.employeeId, user);

                if (result.success) {
                    socket.emit('lock:heartbeat:ack', { ...lockPayload, success: true });
                } else {
                    socket.emit('lock:heartbeat:ack', { ...lockPayload, success: false });
                }
            } catch {
                socket.emit('lock:heartbeat:ack', { ...lockPayload, success: false });
            }
        };

        socket.on('lock:heartbeat', handleLockRefresh);
        socket.on('lock:refresh', handleLockRefresh);

        socket.on('lock:join', (payload: LockSocketPayload) => {
            const lockPayload = normalizeLockPayload(payload);
            if (lockPayload) {
                joinEmployeeRoom(socket, lockPayload.employeeId);
            }
        });

        socket.on('lock:leave', (payload: LockSocketPayload) => {
            const lockPayload = normalizeLockPayload(payload);
            if (lockPayload) {
                leaveEmployeeRoom(socket, lockPayload.employeeId);
            }
        });

        socket.on('lock:status', async (payload: LockSocketPayload) => {
            const lockPayload = normalizeLockPayload(payload);
            if (!lockPayload) {
                socket.emit('lock:status', {
                    isLocked: false,
                    lock: null,
                    isOwner: false,
                    timeRemaining: null
                } as LockInfo);
                return;
            }

            try {
                const lockInfo: LockInfo = await lockService.getLockInfo(lockPayload.employeeId, user.id);
                socket.emit('lock:status', lockInfo);
            } catch {
                socket.emit('lock:status', {
                    isLocked: false,
                    lock: null,
                    isOwner: false,
                    timeRemaining: null
                } as LockInfo);
            }
        });

        socket.on('disconnect', async () => {
        });
    });
}
