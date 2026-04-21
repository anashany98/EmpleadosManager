import { Clock, CheckCircle, UserPlus, UserMinus } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PendingRequestsWidgetProps {
    metrics?: any;
}

export function PendingRequestsWidget({ metrics }: PendingRequestsWidgetProps) {
    const pendingVacations = metrics?.vacation?.pending || 0;
    const pendingExpenses = metrics?.expense?.pending || 0;
    const newHires = metrics?.headcount?.newThisMonth || 0;
    
    const hasPending = pendingVacations > 0 || pendingExpenses > 0;

    return (
        <div className="p-4">
            <div className="flex items-center gap-2 mb-3 text-blue-600">
                <Clock size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">Resumen</span>
            </div>

            <div className="space-y-3">
                {pendingVacations > 0 && (
                    <Link 
                        to="/vacations" 
                        className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Clock size={14} className="text-amber-600" />
                            <span className="text-sm text-amber-700 dark:text-amber-400">
                                Vacaciones pendientes
                            </span>
                        </div>
                        <span className="font-bold text-amber-700 dark:text-amber-400">
                            {pendingVacations}
                        </span>
                    </Link>
                )}

                {pendingExpenses > 0 && (
                    <Link 
                        to="/expenses" 
                        className="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Clock size={14} className="text-orange-600" />
                            <span className="text-sm text-orange-700 dark:text-orange-400">
                                Gastos pendientes
                            </span>
                        </div>
                        <span className="font-bold text-orange-700 dark:text-orange-400">
                            {pendingExpenses}
                        </span>
                    </Link>
                )}

                {newHires > 0 && (
                    <div className="flex items-center justify-between p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                        <div className="flex items-center gap-2">
                            <UserPlus size={14} className="text-emerald-600" />
                            <span className="text-sm text-emerald-700 dark:text-emerald-400">
                                Nuevos este mes
                            </span>
                        </div>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                            +{newHires}
                        </span>
                    </div>
                )}

                {!hasPending && newHires === 0 && (
                    <div className="flex items-center gap-2 text-emerald-600 text-sm">
                        <CheckCircle size={16} />
                        <span>Todo al día</span>
                    </div>
                )}
            </div>
        </div>
    );
}