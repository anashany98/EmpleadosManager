export enum LockAction {
    ACQUIRED = 'ACQUIRED',
    RELEASED = 'RELEASED',
    EXPIRED = 'EXPIRED',
    FORCE_RELEASED = 'FORCE_RELEASED',
    REFRESHED = 'REFRESHED'
}

export interface LockData {
    userId: string;
    userEmail: string;
    userName: string;
    timestamp: number;
    expiresAt: number;
    pageUrl?: string;
}

export interface LockInfo {
    isLocked: boolean;
    lock: LockData | null;
    isOwner: boolean;
    timeRemaining: number | null;
}

export interface LockResult {
    success: boolean;
    lock?: LockData;
    conflict?: LockInfo;
    error?: string;
}

export interface LockAcquiredPayload {
    employeeId: number;
    lock: LockData;
}

export interface LockReleasedPayload {
    employeeId: number;
    userId: string;
    reason: 'manual' | 'expired' | 'force_release';
}

export interface LockFailedPayload {
    employeeId: number;
    currentLock: LockData;
    requestedBy: string;
}

export interface AcquireLockRequest {
    employeeId: number;
}

export interface ForceReleaseRequest {
    reason?: string;
}

export interface LockResponse {
    success: boolean;
    lock?: LockData;
    error?: string;
}

export const LOCK_CONFIG = {
    TTL_SECONDS: 300,
    HEARTBEAT_INTERVAL: 60000,
    KEY_PREFIX: 'lock:employee:'
} as const;