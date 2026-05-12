import { Lock } from 'lucide-react';
import { useLockPolling } from '../../hooks/useLockPolling';

interface LockBannerProps {
    employeeId: string;
    userId?: string;
}

export function LockBanner({ employeeId, userId }: LockBannerProps) {
    const { isLocked, isOwner, currentHolder, timeRemaining } = useLockPolling(employeeId, userId);

    if (!isLocked || isOwner) {
        return null;
    }

    const formatTimeRemaining = (ms: number | null) => {
        if (ms === null) return '';
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        if (minutes > 0) {
            return `${minutes}m`;
        }
        return `${seconds}s`;
    };

    return (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-4">
            <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Registro bloqueado
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                    Actualmente siendo editado por {currentHolder?.name || 'otro usuario'}
                    {timeRemaining !== null && ` · Expira en ${formatTimeRemaining(timeRemaining)}`}
                </p>
            </div>
        </div>
    );
}