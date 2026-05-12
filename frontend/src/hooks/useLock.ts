import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './useSocket';
import type {
    LockInfo,
    LockAcquiredPayload,
    LockReleasedPayload,
    LockFailedPayload,
} from '../interfaces/lock.interfaces';

interface UseLockOptions {
    heartbeatInterval?: number;
}

interface UseLockReturn {
    isLocked: boolean;
    currentHolder: { id: string; name?: string } | null;
    isOwner: boolean;
    timeRemaining: number | null;
    acquireLock: (resourceId: string, resourceType: string) => void;
    releaseLock: (resourceId: string, resourceType: string) => void;
    refreshLock: (resourceId: string, resourceType: string) => void;
}

export function useLock(
    employeeId: string,
    userId?: string,
    options: UseLockOptions = {}
): UseLockReturn {
    const { heartbeatInterval = 60000 } = options;
    const { socket } = useSocket();

    const [lockInfo, setLockInfo] = useState<LockInfo>({
        isLocked: false,
        currentHolder: null,
        acquiredAt: null,
        expiresAt: null,
    });

    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const currentLockRef = useRef<{ resourceId: string; resourceType: string } | null>(null);

    const clearHeartbeat = useCallback(() => {
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
        }
    }, []);

    const startHeartbeat = useCallback((resourceId: string, resourceType: string) => {
        clearHeartbeat();
        heartbeatRef.current = setInterval(() => {
            if (socket?.connected) {
                socket.emit('lock:heartbeat', resourceId);
            }
        }, heartbeatInterval);
    }, [socket, heartbeatInterval, clearHeartbeat]);

    useEffect(() => {
        const handleAcquired = (payload: LockAcquiredPayload) => {
            if (payload.employeeId === employeeId) {
                setLockInfo({
                    isLocked: true,
                    currentHolder: { id: payload.employeeId, name: payload.employeeName },
                    acquiredAt: new Date(payload.acquiredAt),
                    expiresAt: new Date(payload.expiresAt),
                });
                if (currentLockRef.current) {
                    startHeartbeat(currentLockRef.current.resourceId, currentLockRef.current.resourceType);
                }
            }
        };

        const handleReleased = (payload: LockReleasedPayload) => {
            setLockInfo({
                isLocked: false,
                currentHolder: null,
                acquiredAt: null,
                expiresAt: null,
            });
            clearHeartbeat();
            currentLockRef.current = null;
        };

        const handleFailed = (payload: LockFailedPayload) => {
            if (payload.employeeId === employeeId) {
                console.warn('Lock acquisition failed:', payload.reason);
            }
        };

        socket?.on('lock:acquired', handleAcquired);
        socket?.on('lock:released', handleReleased);
        socket?.on('lock:attempt:failed', handleFailed);

        return () => {
            socket?.off('lock:acquired', handleAcquired);
            socket?.off('lock:released', handleReleased);
            socket?.off('lock:attempt:failed', handleFailed);
        };
    }, [socket, employeeId, clearHeartbeat, startHeartbeat]);

    useEffect(() => {
        const handleBeforeUnload = () => {
            if (currentLockRef.current && socket?.connected) {
                const { resourceId, resourceType } = currentLockRef.current;
                navigator.sendBeacon?.(
                    `/api/locks/release?resourceId=${resourceId}&resourceType=${resourceType}&employeeId=${employeeId}`
                );
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [socket, employeeId]);

    useEffect(() => {
        clearHeartbeat();
    }, [clearHeartbeat]);

    const calculateTimeRemaining = useCallback((expiresAt: Date | null): number | null => {
        if (!expiresAt) return null;
        const remaining = expiresAt.getTime() - Date.now();
        return remaining > 0 ? remaining : 0;
    }, []);

    const acquireLock = useCallback((resourceId: string, resourceType: string) => {
        if (!socket?.connected) return;

        currentLockRef.current = { resourceId, resourceType };
        socket.emit('lock:acquire', employeeId);
        startHeartbeat(resourceId, resourceType);
    }, [socket, employeeId, startHeartbeat]);

    const releaseLock = useCallback((resourceId: string, resourceType: string) => {
        if (!socket?.connected) return;

        clearHeartbeat();
        socket.emit('lock:release', resourceId);
        currentLockRef.current = null;
        setLockInfo({
            isLocked: false,
            currentHolder: null,
            acquiredAt: null,
            expiresAt: null,
        });
    }, [socket, clearHeartbeat]);

    const refreshLock = useCallback((resourceId: string, resourceType: string) => {
        if (!socket?.connected) return;

        socket.emit('lock:refresh', { resourceId, resourceType });
    }, [socket]);

    const isOwner = lockInfo.currentHolder?.id === userId;
    const timeRemaining = calculateTimeRemaining(lockInfo.expiresAt);

    return {
        isLocked: lockInfo.isLocked,
        currentHolder: lockInfo.currentHolder,
        isOwner,
        timeRemaining,
        acquireLock,
        releaseLock,
        refreshLock,
    };
}