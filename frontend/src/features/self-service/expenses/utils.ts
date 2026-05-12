import type { Expense, ExpenseEmployeeOption } from './types';

function unwrapData(value: unknown): unknown {
    if (value && typeof value === 'object' && 'data' in value) {
        return (value as { data: unknown }).data;
    }

    return value;
}

function normalizeList<T>(response: unknown): T[] {
    const first = unwrapData(response);
    if (Array.isArray(first)) return first as T[];

    const second = unwrapData(first);
    return Array.isArray(second) ? second as T[] : [];
}

export function normalizeExpenseListResponse(response: unknown): Expense[] {
    return normalizeList<Expense>(response);
}

export function normalizeEmployeeOptionsResponse(response: unknown): ExpenseEmployeeOption[] {
    return normalizeList<ExpenseEmployeeOption>(response).map((employee) => ({
        ...employee,
        name: employee.name || [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim() || employee.dni || employee.id
    }));
}
