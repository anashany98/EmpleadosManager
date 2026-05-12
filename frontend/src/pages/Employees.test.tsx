import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Employees from './Employees';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
    api: {
        get: vi.fn(),
        post: vi.fn()
    }
}));

vi.mock('../context/ConfirmContext', () => ({
    useConfirm: () => vi.fn().mockResolvedValue(true)
}));

vi.mock('../components/BulkActionToolbar', () => ({
    __esModule: true,
    default: () => null,
    EMPLOYEE_BULK_ACTIONS: []
}));

describe('Employees page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(api.get).mockResolvedValue({
            data: {
                data: [
                    { id: 'emp-1', firstName: 'Ana', lastName: 'Gomez', dni: '111', subaccount465: '4651', department: 'IT', active: true },
                    { id: 'emp-2', firstName: 'Luis', lastName: 'Perez', dni: '222', subaccount465: '4652', department: 'Ventas', active: false }
                ],
                meta: {
                    total: 2,
                    page: 1,
                    limit: 20,
                    totalPages: 1
                }
            }
        } as never);
    });

    it('filters the list and keeps selection state outside the page shell', async () => {
        const queryClient = new QueryClient();

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <Employees />
                </MemoryRouter>
            </QueryClientProvider>
        );

        await screen.findAllByText('Ana Gomez');

        fireEvent.change(screen.getByLabelText(/buscar empleados/i), {
            target: { value: 'Luis' }
        });

        await waitFor(() => {
            expect(screen.queryByText('Ana Gomez')).not.toBeInTheDocument();
        });

        fireEvent.click(screen.getByLabelText(/seleccionar todos los empleados/i));

        expect(screen.getByText('1 de 1 seleccionados')).toBeInTheDocument();
    });
});
