import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, ShieldAlert } from 'lucide-react';
import { normalizeRole } from '@shared/authz';
import type { AppFeatureKey } from '@shared/authz';

interface ProtectedRouteProps {
    children: React.ReactNode;
    roles?: string[];
    feature?: AppFeatureKey;
    anyFeature?: AppFeatureKey[];
}

export default function ProtectedRoute({ children, roles, feature, anyFeature }: ProtectedRouteProps) {
    const { user, loading, canAccessFeature } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-blue-600" size={40} />
                    <p className="text-slate-500 font-medium animate-pulse">Verificando sesión...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        sessionStorage.setItem('redirectTo', location.pathname);
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    const isFeatureDenied = feature ? !canAccessFeature(feature) : false;
    const isAnyFeatureDenied = anyFeature?.length ? !anyFeature.some((item) => canAccessFeature(item)) : false;

    if (isFeatureDenied || isAnyFeatureDenied) {
        // Show access denied page instead of silently redirecting
        // This helps debug permission issues and provides better UX
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
                    <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShieldAlert size={32} className="text-rose-500" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Acceso Denegado</h2>
                    <p className="text-slate-500 mb-6">No tienes permisos para acceder a esta sección. Contacta con tu administrador si crees que esto es un error.</p>
                    <p className="text-xs text-slate-400 mb-4">
                        Rol: {user.role} | Feature: {feature || anyFeature?.join(', ')}
                    </p>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                    >
                        Volver al Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (roles && !roles.map((role) => normalizeRole(role)).includes(user.role)) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}
