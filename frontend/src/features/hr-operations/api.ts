import { api } from '../../api/client';
import type { CompanyScope, HrAlertEmailStatus, HrAlertRule, HrMonthlyClose, HrTask, HrTaskOverview, SmartRecord } from './types';

interface Envelope<T> {
    data: T;
    message?: string;
}

const dataOf = <T>(response: Envelope<T> | T): T =>
    response && typeof response === 'object' && 'data' in response
        ? (response as Envelope<T>).data
        : response as T;

export const hrOperationsApi = {
    companies: async () => dataOf<CompanyScope[]>(await api.get('/companies')),
    overview: async (params: Record<string, string | undefined>) =>
        dataOf<HrTaskOverview>(await api.get('/hr-workspace/overview', { params })),
    sync: async (companyId?: string) =>
        dataOf<{ synchronized: number }>(await api.post('/hr-workspace/sync', { companyId })),
    createTask: async (body: Record<string, unknown>) =>
        dataOf<HrTask>(await api.post('/hr-workspace/tasks', body)),
    updateTask: async (id: string, body: Record<string, unknown>) =>
        dataOf<HrTask>(await api.patch(`/hr-workspace/tasks/${id}`, body)),
    alertRules: async (companyId?: string) =>
        dataOf<HrAlertRule[]>(await api.get('/hr-workspace/alert-rules', { params: { companyId } })),
    alertEmailStatus: async (companyId?: string) =>
        dataOf<HrAlertEmailStatus>(await api.get('/hr-workspace/alert-email-status', { params: { companyId } })),
    updateAlertRule: async (id: string, body: Record<string, unknown>) =>
        dataOf<HrAlertRule>(await api.patch(`/hr-workspace/alert-rules/${id}`, body)),
    monthlyClose: async (companyId: string | undefined, year: number, month: number) =>
        dataOf<HrMonthlyClose>(await api.get('/hr-workspace/monthly-close', { params: { companyId, year, month } })),
    updateCloseItem: async (id: string, itemKey: string, completed: boolean) =>
        dataOf<HrMonthlyClose>(await api.patch(`/hr-workspace/monthly-close/${id}/items/${itemKey}`, { completed })),
    setCloseStatus: async (id: string, status: 'OPEN' | 'CLOSED', notes?: string) =>
        dataOf<HrMonthlyClose>(await api.patch(`/hr-workspace/monthly-close/${id}/status`, { status, notes })),
    smartRecord: async (employeeId: string) =>
        dataOf<SmartRecord>(await api.get(`/hr-workspace/employees/${employeeId}/smart-record`))
};
