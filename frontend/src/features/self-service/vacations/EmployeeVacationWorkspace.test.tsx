import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/client', () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }
}));

vi.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: {
            id: 'user-1',
            role: 'admin',
            permissions: { vacations: 'write' }
        }
    })
}));

vi.mock('../../../context/ConfirmContext', () => ({
    useConfirm: () => vi.fn()
}));

vi.mock('./useAbsenceTypeCatalog', () => ({
    useAbsenceTypeCatalog: () => ({
        catalog: {},
        activeCatalog: {
            VACATION: { label: 'Vacaciones' },
            SICK_LEAVE: { label: 'Baja médica' },
            OTHER: { label: 'Otra ausencia' }
        }
    })
}));

import { api } from '../../../api/client';
import { EmployeeVacationWorkspace } from './EmployeeVacationWorkspace';

const mockApi = api as unknown as {
    get: ReturnType<typeof vi.fn>;
};

describe('EmployeeVacationWorkspace', () => {
    beforeEach(() => {
        mockApi.get.mockImplementation((url: string) => {
            if (url === '/employees/employee-1') {
                return Promise.resolve({
                    data: {
                        firstName: 'Alejandro',
                        lastName: 'Díaz',
                        vacationDaysTotal: 30
                    }
                });
            }
            if (url === '/vacations/employee/employee-1') {
                return Promise.resolve({
                    data: [
                        {
                            id: 'absence-1',
                            type: 'SICK_LEAVE',
                            startDate: '2026-07-01',
                            endDate: '2026-07-03',
                            status: 'APPROVED'
                        }
                    ]
                });
            }
            return Promise.resolve({ data: [] });
        });
    });

    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('does not show vacation balance cards inside Ausencias', async () => {
        render(<EmployeeVacationWorkspace employeeId="employee-1" mode="absence" />);

        await waitFor(() => expect(screen.getByText('Ausencias')).toBeInTheDocument());

        expect(screen.queryByText('Días disponibles')).not.toBeInTheDocument();
        expect(screen.queryByText('Días aprobados')).not.toBeInTheDocument();
        expect(screen.queryByText('Días pendientes')).not.toBeInTheDocument();
        expect(screen.queryByText('Flujo compartido activo')).not.toBeInTheDocument();
    });

    it('keeps vacation balance cards in Vacaciones', async () => {
        render(<EmployeeVacationWorkspace employeeId="employee-1" mode="vacation" />);

        await waitFor(() => expect(screen.getByText('Vacaciones')).toBeInTheDocument());

        expect(screen.getByText('Días disponibles')).toBeInTheDocument();
        expect(screen.getByText('Días aprobados')).toBeInTheDocument();
        expect(screen.getByText('Días pendientes')).toBeInTheDocument();
    });
});
