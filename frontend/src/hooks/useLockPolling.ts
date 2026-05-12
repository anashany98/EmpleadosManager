import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';

interface LockInfo {
    isLocked: boolean;
    currentHolder: { id: string; name?: string } | null;
    isOwner: boolean;
    timeRemaining: number | null;
}

export function useLockPolling(employeeId: string | null, userId?: string) {
    const [lockInfo, setLockInfo] = useState<LockInfo>({
        isLocked: false,
        currentHolder: null,
        isOwner: false,
        timeRemaining: null,
    });

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const checkLock = useCallback(async () => {
        if (!employeeId) return;

        try {
            const response = await api.get(`/locks/employee/${employeeId}`);
            const data = response.data;

            setLockInfo({
                isLocked: data.success && data.lock,
                currentHolder: data.lock?.userName ? { id: data.lock.userId, name: data.lock.userName } : null,
                isOwner: data.lock?.userId === userId,
                timeRemaining: data.lock?.expiresAt ? data.lock.expiresAt - Date.now() : null,
            });
        } catch (error) {
            // Silently fail - lock might not exist yet
        }
    }, [employeeId, userId]);

    useEffect(() => {
        if (!employeeId) return;

        checkLock();
        intervalRef.current = setInterval(checkLock, 10000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [employeeId, checkLock]);

    const acquireLock = useCallback(async () => {
        if (!employeeId) return;
        try {
            await api.post(`/locks/employee/${employeeId}`);
            checkLock();
        } catch (error) {
            console.error('Failed to acquire lock:', error);
        }
    }, [employeeId, checkLock]);

    const releaseLock = useCallback(async () => {
        if (!employeeId) return;
        try {
            await api.delete(`/locks/employee/${employeeId}`);
            checkLock();
        } catch (error) {
            console.error('Failed to release lock:', error);
        }
    }, [employeeId, checkLock]);

    return {
        ...lockInfo,
        acquireLock,
        releaseLock,
        refreshLock: checkLock,
    };
}