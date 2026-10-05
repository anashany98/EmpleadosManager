import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Reports from './Reports';
import { api } from '../api/client';

vi.mock('../api/client', () => ({ API_URL: '/api', api: { get: vi.fn(), post: vi.fn().mockResolvedValue({}) } }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin', companyId: null } }) }));
vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const obraData = {
    obras: [{ id: 'o1', code: 'O1', name: 'Obra histórica', status: 'ACTIVE', budget: 1000, hours: 8, empleadosCount: 1, totals: { PER_DIEM: 25, CONTRACTOR: 100 } }],
    totalsByType: { PER_DIEM: 25, CONTRACTOR: 100 }, horasTotales: 8, totalEmpleados: 1, budgets: { budget: 1000, consumed: 125 }
};

describe('Reports screen', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(api.get).mockImplementation(async (url) => {
            if (url === '/companies') return [{ id: 'A', name: 'Empresa A' }];
            if (url === '/employees/options') return { departments: ['Taller'] };
            if (url.startsWith('/reports/obras?')) return obraData;
            return [];
        });
    });
    afterEach(cleanup);

    it('shows historic obra hours and expenses without inherited attendance dates', async () => {
        render(<Reports />);
        fireEvent.click(screen.getByRole('tab', { name: 'Resumen por obra' }));
        expect(await screen.findByText('Obra histórica')).toBeInTheDocument();
        expect(api.get).toHaveBeenCalledWith('/reports/obras?', expect.objectContaining({ signal: expect.any(AbortSignal) }));
        const table = screen.getByRole('table');
        expect(within(table).getByText('8 h')).toBeInTheDocument();
        expect(within(table).getByText(/100,00/)).toBeInTheDocument();
        expect(screen.getByLabelText('Fecha inicial de obras')).toHaveValue('');
        expect(screen.getByLabelText('Fecha final de obras')).toHaveValue('');
        fireEvent.change(screen.getByLabelText('Fecha inicial de obras'), { target: { value: '2026-08-01' } });
        fireEvent.change(screen.getByLabelText('Fecha final de obras'), { target: { value: '2026-08-31' } });
        await waitFor(() => expect(api.get).toHaveBeenCalledWith('/reports/obras?from=2026-08-01&to=2026-08-31', expect.anything()));
        fireEvent.click(screen.getByRole('button', { name: 'Ver histórico completo' }));
        expect(screen.getByLabelText('Fecha inicial de obras')).toHaveValue('');
        expect(await screen.findByText('Obra histórica')).toBeInTheDocument();
    });

    it('schedules the selected obra company, department and dates using the supported type', async () => {
        render(<Reports />);
        fireEvent.click(screen.getByRole('tab', { name: 'Resumen por obra' }));
        await screen.findByText('Obra histórica');
        const selects = screen.getAllByRole('combobox');
        fireEvent.change(selects[0], { target: { value: 'A' } });
        fireEvent.change(selects[1], { target: { value: 'Taller' } });
        fireEvent.change(screen.getByLabelText('Fecha inicial de obras'), { target: { value: '2026-08-01' } });
        fireEvent.change(screen.getByLabelText('Fecha final de obras'), { target: { value: '2026-08-31' } });
        fireEvent.click(screen.getByRole('button', { name: 'Programar Resumen por obra' }));
        fireEvent.click(screen.getByRole('button', { name: 'Programar' }));
        await waitFor(() => expect(api.post).toHaveBeenCalled());
        expect(api.post).toHaveBeenCalledWith('/report-schedules/schedules', expect.objectContaining({ reportType: 'OBRA_SUMMARY', companyId: 'A' }));
        const body = vi.mocked(api.post).mock.calls[0][1] as { params: string };
        expect(JSON.parse(body.params)).toEqual({ companyId: 'A', department: 'Taller', from: '2026-08-01', to: '2026-08-31' });
    });

    it('ignores an old attendance response arriving after the obra report', async () => {
        let resolveAttendance!: (data: unknown) => void;
        const pending = new Promise(resolve => { resolveAttendance = resolve; });
        const get = vi.mocked(api.get).getMockImplementation()!;
        vi.mocked(api.get).mockImplementation((url, options) => url.startsWith('/reports/attendance-summary?') ? pending : get(url, options));
        render(<Reports />);
        fireEvent.click(screen.getByRole('tab', { name: 'Resumen por obra' }));
        await screen.findByText('Obra histórica');
        await act(async () => { resolveAttendance([{ employeeName: 'Respuesta antigua' }]); });
        expect(screen.getByText('Obra histórica')).toBeInTheDocument();
        expect(screen.queryByText('Respuesta antigua')).not.toBeInTheDocument();
    });
});
