import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hrOperationsApi } from '../api';
import { SmartEmployeeRecordPanel } from './SmartEmployeeRecordPanel';

describe('SmartEmployeeRecordPanel', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows completeness, detected issues and the recommended next action', async () => {
        vi.spyOn(hrOperationsApi, 'smartRecord').mockResolvedValue({
            score: 68,
            completed: 8,
            total: 12,
            completedWeight: 13,
            totalWeight: 19,
            missing: [
                { key: 'phone', label: 'Teléfono', actionUrl: '/employees/employee-1?tab=personal' }
            ],
            attention: [
                {
                    id: 'missing-phone',
                    type: 'MISSING_DATA',
                    severity: 'MEDIUM',
                    title: 'Falta teléfono',
                    description: 'Completa el teléfono de contacto.',
                    actionUrl: '/employees/employee-1?tab=personal'
                }
            ],
            tasks: [
                {
                    id: 'task-1',
                    title: 'Revisar contrato',
                    priority: 'HIGH',
                    dueDate: '2026-07-31T00:00:00.000Z',
                    actionUrl: '/hr/tasks?task=task-1'
                }
            ],
            counts: { documents: 5, trainings: 2, medicalReviews: 1, assets: 3 }
        });
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } }
        });

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <SmartEmployeeRecordPanel employeeId="employee-1" />
                </MemoryRouter>
            </QueryClientProvider>
        );

        expect(await screen.findByLabelText('Expediente completado al 68%')).toBeInTheDocument();
        expect(screen.getByText('1 asuntos detectados')).toBeInTheDocument();
        expect(screen.getByText('Revisar contrato')).toBeInTheDocument();
        expect(screen.getByText(/Próximo paso recomendado: completar teléfono/i)).toBeInTheDocument();
    });
});
