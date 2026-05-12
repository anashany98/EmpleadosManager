export interface LockData {
    resourceId: string;
    resourceType: string;
    acquiredAt: string;
    expiresAt: string;
    holderId: string;
    holderName?: string;
}

export interface LockInfo {
    isLocked: boolean;
    currentHolder: {
        id: string;
        name?: string;
    } | null;
    acquiredAt: Date | null;
    expiresAt: Date | null;
}

export interface LockAcquiredPayload {
    resourceId: string;
    resourceType: string;
    employeeId: string;
    employeeName?: string;
    acquiredAt: string;
    expiresAt: string;
}

export interface LockReleasedPayload {
    resourceId: string;
    resourceType: string;
    employeeId: string;
}

export interface LockFailedPayload {
    resourceId: string;
    resourceType: string;
    employeeId: string;
    reason: string;
    currentHolder?: { id: string; name?: string };
}