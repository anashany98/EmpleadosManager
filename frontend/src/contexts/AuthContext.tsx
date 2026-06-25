/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from 'react';
import { api } from '../api/client';
import { canAccessFeature as sharedCanAccessFeature, normalizeActor } from '@shared/authz';
import type { AppFeatureKey, PermissionMap, Role } from '@shared/authz';

interface User {
    id: string;
    email: string;
    role: Role;
    employeeId?: string; // Linked employee ID
    companyId?: string;
    permissions?: PermissionMap;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (userData: User) => void;
    logout: () => void;
    isAdmin: boolean;
    isManager: boolean;
    isEmployee: boolean;
    canAccessFeature: (feature: AppFeatureKey) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_PAGES = new Set(['/login', '/request-reset', '/reset-password']);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const authAttemptedRef = useRef(false);

    const isAdmin = useMemo(() => user?.role === 'admin', [user?.role]);
    const isManager = useMemo(() => user?.role === 'manager' || user?.role === 'hr' || user?.role === 'admin', [user?.role]);
    const isEmployee = useMemo(() => user?.role === 'employee' && !!user?.employeeId, [user?.employeeId, user?.role]);

    const normalizeUser = useCallback((userData: User | null): User | null => {
        const normalized = normalizeActor(userData);
        if (!normalized || !userData?.email) {
            return null;
        }

        return {
            id: normalized.id || userData.id,
            email: userData.email,
            role: normalized.role,
            employeeId: normalized.employeeId,
            companyId: normalized.companyId,
            permissions: normalized.permissions
        };
    }, []);

    // SECURITY: All authentication state lives in HttpOnly cookies set by the
    // backend. The frontend never stores tokens, refresh tokens, or session
    // hints in localStorage / sessionStorage. The session bootstrap is a
    // single /auth/me call whose 200/401 response determines the user state.
    const checkAuth = useCallback(async (): Promise<void> => {
        try {
            const response = await api.get<{ data: User }>('/auth/me');
            setUser(normalizeUser(response.data));
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, [normalizeUser]);

    const bootstrapAuth = useCallback(async (): Promise<void> => {
        if (authAttemptedRef.current) return;
        authAttemptedRef.current = true;
        // Always call /auth/me; the backend will return 401 if no valid cookie
        await checkAuth();
    }, [checkAuth]);

    useEffect(() => {
        bootstrapAuth();
    }, [bootstrapAuth]);

    const login = useCallback((userData: User): void => {
        setUser(normalizeUser(userData));
    }, [normalizeUser]);

    const logout = useCallback(async (): Promise<void> => {
        try {
            await api.post('/auth/logout', {});
        } catch (error) {
            console.error('Logout error', error);
        }
        setUser(null);
        window.location.href = '/login';
    }, []);

    const canAccessFeature = useCallback((feature: AppFeatureKey): boolean => {
        // Delegamos en la matriz APP_FEATURES de @shared/authz: ese módulo
        // es la fuente de verdad (módulo, nivel, roles, requireEmployee) y se
        // mantiene en sincronía con el backend (routes/* con checkPermission).
        // Antes se reimplementaba aquí un subset y se dejaba pasar el resto.
        if (!user) return false;
        return sharedCanAccessFeature(feature, user);
    }, [user]);

    const value = useMemo(() => ({
        user,
        loading,
        login,
        logout,
        isAdmin,
        isManager,
        isEmployee,
        canAccessFeature
    }), [user, loading, login, logout, isAdmin, isManager, isEmployee, canAccessFeature]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
