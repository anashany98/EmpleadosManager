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

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async ({ params }: any) => {
        const allEmployees = [
            { id: 'emp-1', firstName: 'Ana', lastName: 'Gomez', dni: '111', subaccount465: '4651', department: 'IT', active: true },
            { id: 'emp-2', firstName: 'Luis', lastName: 'Perez', dni: '222', subaccount465: '4652', department: 'Ventas', active: false }
        ];
        const search = (params?.search || '').toLowerCase();
        let filtered = allEmployees;
        if (search) {
            filtered = allEmployees.filter(e =>
                `${e.firstName} ${e.lastName}`.toLowerCase().includes(search) ||
                e.dni.toLowerCase().includes(search)
            );
        }
        // El backend retorna el sobre `paginated` directo:
        //   { success: true, message, data: [...], meta: {...} }
        // (ver `ApiResponse.paginated` en el backend). El
        // `customFetch` del cliente lo devuelve tal cual, sin
        // envolver en `data` adicional estilo axios.
        return {
            success: true,
            message: 'OK',
            data: filtered,
            meta: {
                total: filtered.length,
                page: params?.page || 1,
                limit: params?.limit || 20,
                totalPages: Math.ceil(filtered.length / (params?.limit || 20))
            }
        } as never;
    });
});

describe('Employees page', () => {
    it('filters the list via server-side search', async () => {
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

        await waitFor(() => {
            expect(screen.getAllByText('Luis Perez').length).toBeGreaterThan(0);
        });
    });
});
