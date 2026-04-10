import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EmployeeDetail from './EmployeeDetail';
import { api } from '../api/client';

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
            role: 'admin',
            employeeId: 'admin-1'
        }
    })
}));

vi.mock('../components/FaceEnrollModal', () => ({
    FaceEnrollModal: () => null
}));

vi.mock('../components/OnboardingWizard', () => ({
    default: () => null
}));

vi.mock('../components/OffboardingWizard', () => ({
    default: () => null
}));

vi.mock('../features/employee-detail/components/EmployeeViewTabContent', () => ({
    EmployeeViewTabContent: ({ activeTab }: { activeTab: string }) => <div>view-{activeTab}</div>
}));

vi.mock('../features/employee-detail/components/EmployeeEditTabContent', () => ({
    EmployeeEditTabContent: ({ activeTab }: { activeTab: string }) => <div>edit-{activeTab}</div>
}));

describe('EmployeeDetail', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(api.get).mockImplementation(async (endpoint: string) => {
            if (endpoint === '/companies') {
                return { data: [{ id: 'company-1', name: 'Acme' }] } as never;
            }

            if (endpoint === '/employees') {
                return {
                    data: [
                        { id: 'emp-2', firstName: 'Luis', lastName: 'Perez', jobTitle: 'Tecnico' }
                    ]
                } as never;
            }

            if (endpoint === '/employees/emp-1') {
                return {
                    data: {
                        id: 'emp-1',
                        firstName: 'Ana',
                        lastName: 'Admin',
                        dni: '12345678A',
                        department: 'IT',
                        active: true,
                        emergencyContacts: []
                    }
                } as never;
            }

            if (endpoint === '/audit/EMPLOYEE/emp-1') {
                return { data: [] } as never;
            }

            return { data: [] } as never;
        });
    });

    it('renders admin tabs and switches cleanly between view and edit shells', async () => {
        render(
            <MemoryRouter initialEntries={['/employees/emp-1']}>
                <Routes>
                    <Route path="/employees/:id" element={<EmployeeDetail />} />
                </Routes>
            </MemoryRouter>
        );

        await screen.findByText('Ana Admin');

        fireEvent.click(screen.getByRole('button', { name: /seguridad/i }));
        expect(await screen.findByText('view-seguridad')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /editar perfil/i }));

        expect(screen.getByRole('button', { name: /personal/i })).toBeInTheDocument();
        expect(screen.getByText('edit-personal')).toBeInTheDocument();
    });
});
