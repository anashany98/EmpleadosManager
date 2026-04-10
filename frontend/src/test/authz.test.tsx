import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext', () => ({
    useAuth: vi.fn()
}));

const mockedUseAuth = vi.mocked(useAuth);

describe('ProtectedRoute', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the target route when the feature is allowed', () => {
        const authValue = {
            user: { id: '1', email: 'manager@test.com', role: 'manager' },
            loading: false,
            login: vi.fn(),
            logout: vi.fn(),
            isAdmin: false,
            isManager: true,
            isEmployee: false,
            canAccessFeature: vi.fn().mockReturnValue(true)
        };

        mockedUseAuth.mockReturnValue({
            ...authValue
        } as ReturnType<typeof useAuth>);

        render(
            <MemoryRouter initialEntries={['/employees']}>
                <Routes>
                    <Route path="/" element={<div>home</div>} />
                    <Route
                        path="/employees"
                        element={(
                            <ProtectedRoute feature="employees">
                                <div>employees-page</div>
                            </ProtectedRoute>
                        )}
                    />
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByText('employees-page')).toBeInTheDocument();
    });

    it('redirects to home when the feature is denied', () => {
        const authValue = {
            user: { id: '2', email: 'employee@test.com', role: 'employee', employeeId: 'emp-1' },
            loading: false,
            login: vi.fn(),
            logout: vi.fn(),
            isAdmin: false,
            isManager: false,
            isEmployee: true,
            canAccessFeature: vi.fn().mockReturnValue(false)
        };

        mockedUseAuth.mockReturnValue({
            ...authValue
        } as ReturnType<typeof useAuth>);

        render(
            <MemoryRouter initialEntries={['/users']}>
                <Routes>
                    <Route path="/" element={<div>home</div>} />
                    <Route
                        path="/users"
                        element={(
                            <ProtectedRoute feature="users">
                                <div>users-page</div>
                            </ProtectedRoute>
                        )}
                    />
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByText('home')).toBeInTheDocument();
        expect(screen.queryByText('users-page')).not.toBeInTheDocument();
    });
});
