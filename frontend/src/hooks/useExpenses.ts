import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

interface Expense {
    id: string;
    employeeId: string;
    category: string;
    amount: number;
    description: string;
    receiptUrl?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
    updatedAt: string;
}

interface ExpensesResponse {
    success: boolean;
    message?: string;
    data: Expense[];
    meta?: { total: number; page: number; limit: number; totalPages: number };
}

export function useExpenses(employeeId?: string) {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchExpenses = useCallback(async () => {
        try {
            setLoading(true);
            const endpoint = employeeId
                ? `/expenses/employee/${employeeId}`
                : '/expenses';
            const res = await api.get<ExpensesResponse>(endpoint);
            if (res.success) {
                setExpenses(res.data);
            }
            setError(null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error loading expenses');
        } finally {
            setLoading(false);
        }
    }, [employeeId]);

    const createExpense = useCallback(async (expense: Omit<Expense, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => {
        const res = await api.post<{ success: boolean; data: Expense }>('/expenses', expense);
        if (res.success) {
            setExpenses(prev => [res.data, ...prev]);
            return res.data;
        }
        throw new Error('Create failed');
    }, []);

    const updateExpenseStatus = useCallback(async (id: string, status: 'APPROVED' | 'REJECTED') => {
        const res = await api.patch<{ success: boolean; data: Expense }>(`/expenses/${id}/status`, { status });
        if (res.success) {
            setExpenses(prev => prev.map(e => e.id === id ? res.data : e));
            return res.data;
        }
        throw new Error('Update failed');
    }, []);

    useEffect(() => {
        fetchExpenses();
    }, [fetchExpenses]);

    return {
        expenses,
        loading,
        error,
        fetchExpenses,
        createExpense,
        updateExpenseStatus
    };
}
