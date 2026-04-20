/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { api } from '../api/client';
import { canAccessFeature as canSharedAccessFeature, normalizeActor } from '@shared/authz';
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
    login: (token: string, refreshToken: string, userData: User) => void;
    logout: () => void;
    isAdmin: boolean;
    isManager: boolean;
    isEmployee: boolean;
    canAccessFeature: (feature: AppFeatureKey) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_SESSION_HINT_KEY = 'rrhh_auth_session_hint';
const AUTH_PAGES = new Set(['/login', '/request-reset', '/reset-password']);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

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

    const hasSessionHint = useCallback((): boolean => {
        try {
            return window.localStorage.getItem(AUTH_SESSION_HINT_KEY) === '1';
        } catch {
            return false;
        }
    }, []);

    const setSessionHint = useCallback((value: boolean): void => {
        try {
            if (value) {
                window.localStorage.setItem(AUTH_SESSION_HINT_KEY, '1');
            } else {
                window.localStorage.removeItem(AUTH_SESSION_HINT_KEY);
            }
        } catch {
            // Ignore storage errors
        }
    }, []);

    const checkAuth = useCallback(async (): Promise<void> => {
        try {
            const response = await api.get<{ data: User }>('/auth/me');
            setUser(normalizeUser(response.data));
            setSessionHint(true);
        } catch {
            setUser(null);
            setSessionHint(false);
        } finally {
            setLoading(false);
        }
    }, [normalizeUser, setSessionHint]);

    const bootstrapAuth = useCallback(async (): Promise<void> => {
        const path = window.location.pathname;
        const isAuthPage = AUTH_PAGES.has(path);
        if (isAuthPage && !hasSessionHint()) {
            setLoading(false);
            return;
        }
        await checkAuth();
    }, [hasSessionHint, checkAuth]);

    useEffect(() => {
        bootstrapAuth();
    }, [bootstrapAuth]);

    const login = useCallback((_token: string, _refreshToken: string, userData: User): void => {
        setUser(normalizeUser(userData));
        setSessionHint(true);
    }, [normalizeUser, setSessionHint]);

    const logout = useCallback(async (): Promise<void> => {
        try {
            await api.post('/auth/logout', {});
        } catch (error) {
            console.error('Logout error', error);
        }
        setUser(null);
        setSessionHint(false);
        window.location.href = '/login';
    }, [setSessionHint]);

    const canAccessFeature = useCallback((feature: AppFeatureKey): boolean => {
        const isGlobalAdmin = user?.role === 'admin' && !user?.companyId;

        if ((feature === 'users' || feature === 'settings' || feature === 'audit') && !isGlobalAdmin) {
            return false;
        }

        const result = canSharedAccessFeature(feature, user);

        // Debug logging for inbox feature
        if (feature === 'inbox') {
            console.log('[Auth] canAccessFeature inbox:', {
                role: user?.role,
                companyId: user?.companyId,
                employeeId: user?.employeeId,
                permissions: user?.permissions,
                isGlobalAdmin,
                result
            });
        }

        return result;
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
