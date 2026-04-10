import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { normalizeRole } from '@shared/authz';
import type { AppFeatureKey } from '@shared/authz';

interface ProtectedRouteProps {
    children: React.ReactNode;
    roles?: string[];
    feature?: AppFeatureKey;
}

export default function ProtectedRoute({ children, roles, feature }: ProtectedRouteProps) {
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
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (feature && !canAccessFeature(feature)) {
        return <Navigate to="/" replace />;
    }

    if (roles && !roles.map((role) => normalizeRole(role)).includes(user.role)) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}
