import { useMemo, useState } from 'react';
import { Briefcase, User } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { hasModuleAccess, normalizeActor } from '@shared/authz';
import { ExpenseManagementView } from './ExpenseManagementView';
import { MyExpensesView } from './MyExpensesView';

type ExpensesPortalMode = 'SELF' | 'BACKOFFICE';

export default function ExpensesPortalPage() {
    const { user } = useAuth();
    const actor = useMemo(() => normalizeActor(user), [user]);
    const hasSelfService = !!user?.employeeId;
    const hasBackoffice = Boolean(actor && actor.role !== 'employee' && hasModuleAccess(actor, 'expenses', 'write'));

    const defaultMode = useMemo<ExpensesPortalMode>(() => {
        if (hasSelfService) {
            return 'SELF';
        }

        return 'BACKOFFICE';
    }, [hasSelfService]);

    const [mode, setMode] = useState<ExpensesPortalMode>(defaultMode);

    return (
        <div className="space-y-4 sm:space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">Gastos y dietas</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    {hasBackoffice && hasSelfService
                        ? 'Autoservicio y revision operativa separados bajo la misma policy.'
                        : hasBackoffice
                            ? 'Workspace operativo para revision del equipo.'
                            : 'Portal personal para tickets y reembolsos.'}
                </p>
            </div>

            {hasBackoffice ? (
                <div className="flex flex-wrap bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-fit">
                    <button
                        onClick={() => setMode('SELF')}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${mode === 'SELF' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                    >
                        <User size={16} />
                        Autoservicio
                    </button>
                    <button
                        onClick={() => setMode('BACKOFFICE')}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${mode === 'BACKOFFICE' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                    >
                        <Briefcase size={16} />
                        Backoffice
                    </button>
                </div>
            ) : null}

            {mode === 'BACKOFFICE' && hasBackoffice ? <ExpenseManagementView /> : <MyExpensesView />}
        </div>
    );
}
