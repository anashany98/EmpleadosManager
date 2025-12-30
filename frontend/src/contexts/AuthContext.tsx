import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '../api/client';

interface User {
    id: string;
    email: string;
    role: string;
    permissions?: Record<string, 'none' | 'read' | 'write' | 'admin'>;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (token: string, refreshToken: string, userData: User) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            const response = await api.get('/auth/me');
            setUser(response.data);
        } catch (error) {
            // Let the client interceptor handle refresh. 
            // If getMe fails after interceptor, then we logout.
            // But here we might just invalid session if direct call fails?
            // Usually client.ts handles the retry. If it eventually fails:
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = (token: string, refreshToken: string, userData: User) => {
        localStorage.setItem('token', token);
        localStorage.setItem('refreshToken', refreshToken);
        setUser(userData);
    };

    const logout = async () => {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
            try {
                await api.post('/auth/logout', { refreshToken });
            } catch (error) {
                console.error('Logout error', error);
            }
        }
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        setUser(null);
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
