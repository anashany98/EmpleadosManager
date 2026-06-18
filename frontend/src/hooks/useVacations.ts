import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

interface Vacation {
    id: string;
    employeeId: string;
    startDate: string;
    endDate: string;
    type: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    notes?: string;
    createdAt: string;
}

interface VacationsResponse {
    success: boolean;
    message?: string;
    data: Vacation[];
    meta?: { total: number; page: number; limit: number; totalPages: number };
}

export function useVacations(employeeId?: string) {
    const [vacations, setVacations] = useState<Vacation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchVacations = useCallback(async () => {
        try {
            setLoading(true);
            const endpoint = employeeId
                ? `/vacations/employee/${employeeId}`
                : '/vacations';
            const res = await api.get<VacationsResponse>(endpoint);
            if (res.success) {
                setVacations(res.data);
            }
            setError(null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error loading vacations');
        } finally {
            setLoading(false);
        }
    }, [employeeId]);

    const requestVacation = useCallback(async (vacation: Omit<Vacation, 'id' | 'status' | 'createdAt'>) => {
        const res = await api.post<{ success: boolean; data: Vacation }>('/vacations', vacation);
        if (res.success) {
            setVacations(prev => [res.data, ...prev]);
            return res.data;
        }
        throw new Error('Request failed');
    }, []);

    const updateVacationStatus = useCallback(async (id: string, status: 'APPROVED' | 'REJECTED') => {
        const res = await api.patch<{ success: boolean; data: Vacation }>(`/vacations/${id}/status`, { status });
        if (res.success) {
            setVacations(prev => prev.map(v => v.id === id ? res.data : v));
            return res.data;
        }
        throw new Error('Update failed');
    }, []);

    useEffect(() => {
        fetchVacations();
    }, [fetchVacations]);

    return {
        vacations,
        loading,
        error,
        fetchVacations,
        requestVacation,
        updateVacationStatus
    };
}
