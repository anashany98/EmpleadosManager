import { api } from '../../../api/client';
import type { VacationBalanceSummary, VacationRequest, VacationRequestInput, VacationStats } from './types';

export function buildVacationRequestFormData(input: VacationRequestInput): FormData {
    const formData = new FormData();

    formData.append('employeeId', input.employeeId);
    formData.append('startDate', new Date(input.startDate).toISOString());
    formData.append('endDate', new Date(input.endDate).toISOString());
    formData.append('type', input.type);

    const trimmedReason = input.reason?.trim();
    if (trimmedReason) {
        formData.append('reason', trimmedReason);
    }

    if (input.attachment) {
        formData.append('attachment', input.attachment);
    }

    return formData;
}

export async function createVacationRequest(input: VacationRequestInput) {
    return api.post('/vacations', buildVacationRequestFormData(input));
}

export function calculateVacationStats(requests: VacationRequest[], total: number, balance?: VacationBalanceSummary | null): VacationStats {
    if (balance) {
        return {
            total: balance.totalEntitledDays,
            used: balance.importedUsedDays + balance.approvedUsedDays,
            pending: balance.pendingDays,
            available: balance.projectedAvailableDays
        };
    }

    const currentYear = new Date().getFullYear();
    const used = requests
        .filter((item) => new Date(item.startDate).getFullYear() === currentYear)
        .filter((item) => item.status === 'APPROVED')
        .reduce((sum, item) => sum + (item.days || 0), 0);
    const pending = requests
        .filter((item) => new Date(item.startDate).getFullYear() === currentYear)
        .filter((item) => item.status === 'PENDING')
        .reduce((sum, item) => sum + (item.days || 0), 0);

  return {
    total,
    used,
    pending,
    available: total - used - pending
  };
}
