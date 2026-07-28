export const ABSENCE_UPDATED_EVENT = 'absence-updated';

export interface AbsenceUpdatedDetail {
    employeeId?: string;
    requestId?: string;
    action?: 'CREATED' | 'UPDATED' | 'DELETED' | 'STATUS_CHANGED';
}

export function notifyAbsenceUpdated(detail: AbsenceUpdatedDetail = {}) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent<AbsenceUpdatedDetail>(ABSENCE_UPDATED_EVENT, { detail }));
}
