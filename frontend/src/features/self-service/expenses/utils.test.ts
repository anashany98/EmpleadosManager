import { describe, expect, it } from 'vitest';
import { normalizeExpenseListResponse } from './utils';
import type { Expense } from './types';

const expense: Expense = {
    id: 'expense-1',
    date: '2026-04-28T00:00:00.000Z',
    amount: 12.5,
    category: 'MEALS',
    description: 'Comida cliente',
    status: 'PENDING',
    paymentMethod: 'CASH'
};

describe('normalizeExpenseListResponse', () => {
    it('supports direct array responses', () => {
        expect(normalizeExpenseListResponse([expense])).toEqual([expense]);
    });

    it('supports API envelope responses', () => {
        expect(normalizeExpenseListResponse({ data: [expense] })).toEqual([expense]);
    });

    it('supports paginated API envelope responses', () => {
        expect(normalizeExpenseListResponse({ data: { data: [expense], meta: { total: 1 } } })).toEqual([expense]);
    });
});
