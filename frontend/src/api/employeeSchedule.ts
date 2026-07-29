import { api } from './client';

export interface ScheduleDay {
    date: string;                  // YYYY-MM-DD
    entry1: string | null;
    exit1: string | null;
    entry2: string | null;
    exit2: string | null;
    discountMin: number;
    notes: string | null;
    /** Calculado en backend */
    hoursWorked: number;
    hoursExtra: number;
    hoursExtraFestive: number;
    isWeekend: boolean;
    isHoliday: boolean;
    holidayName?: string;
}

export interface MonthSummary {
    year: number;
    month: number;
    totalWorked: number;
    totalExtra: number;
    totalExtraFestive: number;
    days: ScheduleDay[];
}

export const employeeScheduleApi = {
    getMonth: (employeeId: string, year: number, month: number) =>
        api.get<MonthSummary>(`/employees/${employeeId}/schedule`, { params: { year, month } }),

    upsertDay: (
        employeeId: string,
        day: {
            date: string;
            entry1?: string | null;
            exit1?: string | null;
            entry2?: string | null;
            exit2?: string | null;
            discountMin?: number;
            notes?: string | null;
        },
    ) => api.put(`/employees/${employeeId}/schedule`, day),

    deleteDay: (employeeId: string, date: string) =>
        api.delete(`/employees/${employeeId}/schedule/${date}`),
};
