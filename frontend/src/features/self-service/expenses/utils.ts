import type { Expense, ExpenseEmployeeOption } from './types';
import { unwrapResponse } from '../../../hooks/useApiUnwrap';

function normalizeList<T>(response: unknown): T[] {
    const unwrapped = unwrapResponse<T[]>(response);
    return Array.isArray(unwrapped) ? unwrapped : [];
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
