import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import PayrollControlPage from './PayrollControlPage';

vi.mock('../api/client', () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn()
    }
}));

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: {
            id: 'global-admin',
            role: 'admin',
            companyId: null
        }
    })
}));

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn()
    }
}));

describe('PayrollControlPage para administrador global', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
        vi.mocked(api.get).mockImplementation(async (endpoint: string, config?: any) => {
            if (endpoint === '/companies') {
                return {
                    data: [
                        { id: 'company-1', name: 'Empresa Uno' },
                        { id: 'company-2', name: 'Empresa Dos' }
                    ]
                } as never;
            }

            if (endpoint === '/payroll/control') {
                if (config?.params?.month === 10) {
                    throw Object.assign(new Error('El período no existe'), { status: 404 });
                }
                return {
                    data: {
                        id: `period-${config?.params?.companyId || 'missing'}`,
                        year: 2026,
                        month: 7,
                        status: 'DRAFT',
                        records: []
                    }
                } as never;
            }

            if (endpoint === '/payroll/control/periods') {
                return {
                    data: [
                        {
                            id: 'period-june',
                            year: 2026,
                            month: 6,
                            status: 'DRAFT',
                            employeeCount: 20,
                            totalOvertimeAmount: 3488.4,
                            totalDiets: 1745,
                            totalGross: 6210,
                            exportCount: 0
                        }
                    ]
                } as never;
            }

            return { data: [] } as never;
        });
    });

    it('obliga a seleccionar empresa y envía companyId al cargar el período', async () => {
        render(<PayrollControlPage />);

        const companySelector = await screen.findByRole('combobox', { name: /empresa/i });
        expect(companySelector).toHaveValue('company-1');

        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith('/payroll/control', {
                params: expect.objectContaining({ companyId: 'company-1' })
            });
        });

        fireEvent.change(companySelector, { target: { value: 'company-2' } });

        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith('/payroll/control', {
                params: expect.objectContaining({ companyId: 'company-2' })
            });
        });
    });

    it('muestra el historial mensual y permite abrir un periodo anterior en la misma tabla', async () => {
        render(<PayrollControlPage />);

        const historyEntry = await screen.findByRole('button', { name: /junio 2026/i });
        expect(historyEntry).toHaveTextContent('20 empleados');

        fireEvent.click(historyEntry);

        await waitFor(() => {
            expect(api.get).toHaveBeenCalledWith('/payroll/control', {
                params: expect.objectContaining({
                    companyId: 'company-1',
                    year: 2026,
                    month: 6
                })
            });
        });
    });

    it('abre el control mensual en un modal de pantalla completa y permite cerrarlo', async () => {
        render(<PayrollControlPage />);

        const openButton = await screen.findByRole('button', { name: /abrir control mensual/i });
        fireEvent.click(openButton);

        const dialog = await screen.findByRole('dialog', { name: /revisión mensual/i });
        expect(dialog).toHaveClass('fixed', 'inset-0');
        expect(screen.getByRole('button', { name: /cerrar revisión mensual/i })).toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape' });

        await waitFor(() => {
            expect(screen.queryByRole('dialog', { name: /revisión mensual/i })).not.toBeInTheDocument();
        });
    });

    it('no crea un período al consultarlo y exige una asignación explícita', async () => {
        render(<PayrollControlPage />);

        const octoberOption = screen.getByRole('option', { name: 'Octubre' });
        fireEvent.change(octoberOption.parentElement as HTMLSelectElement, { target: { value: '10' } });

        const createButton = await screen.findByRole('button', { name: /crear período y asignar empleados/i });
        fireEvent.click(createButton);

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith('/payroll/control/periods', expect.objectContaining({
                companyId: 'company-1',
                month: 10
            }));
        });
    });
});
