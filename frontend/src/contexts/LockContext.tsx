import React, { createContext, useContext, useEffect, useRef, useCallback, useState, type ReactNode } from 'react';
import { useSocket } from '../hooks/useSocket';
import type {
    LockInfo,
    LockAcquiredPayload,
    LockReleasedPayload,
    LockFailedPayload,
} from '../interfaces/lock.interfaces';

interface LockContextValue {
    isLocked: (resourceId: string, resourceType: string) => boolean;
    getLockInfo: (resourceId: string, resourceType: string) => LockInfo;
    acquireLock: (resourceId: string, resourceType: string) => void;
    releaseLock: (resourceId: string, resourceType: string) => void;
    refreshLock: (resourceId: string, resourceType: string) => void;
}

const LockContext = createContext<LockContextValue | null>(null);

interface LockProviderProps {
    children: ReactNode;
    employeeId: string;
    heartbeatInterval?: number;
}

interface LockEntry {
    info: LockInfo;
    heartbeatTimer: ReturnType<typeof setInterval> | null;
}

export function LockProvider({ children, employeeId, heartbeatInterval = 60000 }: LockProviderProps) {
    const { socket } = useSocket();
    const [locks, setLocks] = useState<Map<string, LockEntry>>(new Map());
    const locksRef = useRef<Map<string, LockEntry>>(new Map());

    const getLockKey = (resourceId: string, resourceType: string) => `${resourceType}:${resourceId}`;

    const clearHeartbeat = useCallback((key: string) => {
        const entry = locksRef.current.get(key);
        if (entry?.heartbeatTimer) {
            clearInterval(entry.heartbeatTimer);
            entry.heartbeatTimer = null;
        }
    }, []);

    const startHeartbeat = useCallback((resourceId: string, resourceType: string) => {
        const key = getLockKey(resourceId, resourceType);
        clearHeartbeat(key);

        const timer = setInterval(() => {
            if (socket?.connected) {
                socket.emit('lock:heartbeat', { resourceId, resourceType });
            }
        }, heartbeatInterval);

        const entry = locksRef.current.get(key);
        if (entry) {
            entry.heartbeatTimer = timer;
        } else {
            locksRef.current.set(key, { info: { isLocked: false, currentHolder: null, acquiredAt: null, expiresAt: null }, heartbeatTimer: timer });
        }
    }, [socket, heartbeatInterval, clearHeartbeat]);

    useEffect(() => {
        const handleAcquired = (payload: LockAcquiredPayload) => {
            const key = getLockKey(payload.resourceId, payload.resourceType);

            const newEntry: LockEntry = {
                info: {
                    isLocked: true,
                    currentHolder: { id: payload.employeeId, name: payload.employeeName },
                    acquiredAt: new Date(payload.acquiredAt),
                    expiresAt: new Date(payload.expiresAt),
                },
                heartbeatTimer: null,
            };

            locksRef.current.set(key, newEntry);
            setLocks(new Map(locksRef.current));

            const currentKey = locksRef.current.get(key);
            if (currentKey?.info.currentHolder?.id === employeeId) {
                startHeartbeat(payload.resourceId, payload.resourceType);
            }
        };

        const handleReleased = (payload: LockReleasedPayload) => {
            const key = getLockKey(payload.resourceId, payload.resourceType);
            clearHeartbeat(key);
            locksRef.current.delete(key);
            setLocks(new Map(locksRef.current));
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
            locksRef.current.forEach((entry, key) => {
                if (entry.info.currentHolder?.id === employeeId && socket?.connected) {
                    const [resourceType, resourceId] = key.split(':');
                    navigator.sendBeacon?.(
                        `/api/locks/release?resourceId=${resourceId}&resourceType=${resourceType}&employeeId=${employeeId}`
                    );
                }
            });
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [socket, employeeId]);

    useEffect(() => {
        locksRef.current.forEach((entry) => {
            if (entry.heartbeatTimer) {
                clearInterval(entry.heartbeatTimer);
            }
        });
        locksRef.current.clear();
    }, []);

    const isLocked = useCallback((resourceId: string, resourceType: string) => {
        const key = getLockKey(resourceId, resourceType);
        return locksRef.current.get(key)?.info.isLocked ?? false;
    }, []);

    const getLockInfo = useCallback((resourceId: string, resourceType: string): LockInfo => {
        const key = getLockKey(resourceId, resourceType);
        return locksRef.current.get(key)?.info ?? {
            isLocked: false,
            currentHolder: null,
            acquiredAt: null,
            expiresAt: null,
        };
    }, []);

    const acquireLock = useCallback((resourceId: string, resourceType: string) => {
        if (!socket?.connected) return;
        socket.emit('lock:acquire', { resourceId, resourceType, employeeId });
    }, [socket, employeeId]);

    const releaseLock = useCallback((resourceId: string, resourceType: string) => {
        if (!socket?.connected) return;
        const key = getLockKey(resourceId, resourceType);
        clearHeartbeat(key);
        socket.emit('lock:release', { resourceId, resourceType });
        const entry = locksRef.current.get(key);
        if (entry) {
            entry.info = { isLocked: false, currentHolder: null, acquiredAt: null, expiresAt: null };
            setLocks(new Map(locksRef.current));
        }
    }, [socket, clearHeartbeat]);

    const refreshLock = useCallback((resourceId: string, resourceType: string) => {
        if (!socket?.connected) return;
        socket.emit('lock:refresh', { resourceId, resourceType });
    }, [socket]);

    return (
        <LockContext.Provider value={{ isLocked, getLockInfo, acquireLock, releaseLock, refreshLock }}>
            {children}
        </LockContext.Provider>
    );
}

export function useLockContext() {
    const context = useContext(LockContext);
    if (!context) {
        throw new Error('useLockContext must be used within a LockProvider');
    }
    return context;
}