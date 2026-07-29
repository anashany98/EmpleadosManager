import { CalendarDays, ChevronRight, Plane, TrendingUp } from 'lucide-react';
import { OvertimeTracker } from './OvertimeTracker';
import type { EmployeeViewRecord } from '../types';
import { SmartEmployeeRecordPanel } from '../../hr-operations/components/SmartEmployeeRecordPanel';

export function EmployeeSummarySection({
    employeeId,
    employeeView,
    onNavigateToVacations
}: {
    employeeId: string;
    employeeView: EmployeeViewRecord;
    onNavigateToVacations?: () => void;
}) {
    const vacationBalance = employeeView.vacationBalance;
    const availableDays = vacationBalance?.projectedAvailableDays ?? vacationBalance?.availableDays ?? employeeView.vacationDaysTotal ?? 30;
    const totalEntitled = vacationBalance?.totalEntitledDays ?? employeeView.vacationDaysTotal ?? 30;
    const usedDays = (vacationBalance?.importedUsedDays ?? 0) + (vacationBalance?.approvedUsedDays ?? 0);
    const pendingDays = vacationBalance?.pendingDays ?? 0;
    const carriedOver = vacationBalance?.carriedOverDays ?? 0;
    const usedPercentage = totalEntitled > 0 ? Math.min(100, Math.round((usedDays / totalEntitled) * 100)) : 0;

    return (
        <div className="space-y-8">
            <SmartEmployeeRecordPanel employeeId={employeeId} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <p className="text-slate-500 text-sm font-medium mb-1">Subcuenta Contable</p>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{employeeView.subaccount465}</h3>
                </div>

                {/* Saldo Vacaciones - Card enriquecido con atajo al tab */}
                <button
                    type="button"
                    onClick={onNavigateToVacations}
                    className="group relative bg-gradient-to-br from-indigo-50 via-white to-emerald-50 dark:from-indigo-950/40 dark:via-slate-900 dark:to-emerald-950/40 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 text-left transition-all hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-700"
                >
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
                                <Plane size={14} className="text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Saldo Vacaciones</p>
                        </div>
                        <ChevronRight size={16} className="text-indigo-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                    </div>

                    <div className="flex items-baseline gap-2 mb-3">
                        <h3 className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{availableDays}</h3>
                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">días disponibles</span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all"
                            style={{ width: `${100 - usedPercentage}%` }}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <div className="flex flex-col">
                            <span className="text-slate-400 dark:text-slate-500 font-bold uppercase">Total</span>
                            <span className="font-black text-slate-900 dark:text-white text-sm">{totalEntitled}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-rose-400 font-bold uppercase">Usados</span>
                            <span className="font-black text-rose-600 dark:text-rose-400 text-sm">{usedDays}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-amber-400 font-bold uppercase">Pend.</span>
                            <span className="font-black text-amber-600 dark:text-amber-400 text-sm">{pendingDays}</span>
                        </div>
                    </div>

                    {carriedOver > 0 && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 italic">
                            + {carriedOver} días arrastrados
                        </p>
                    )}
                </button>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <p className="text-slate-500 text-sm font-medium mb-1">Antigüedad</p>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                        {employeeView.entryDate
                            ? new Date(employeeView.entryDate).toLocaleDateString()
                            : (employeeView.seniorityDate ? new Date(employeeView.seniorityDate).toLocaleDateString() : '--')}
                    </h3>
                </div>
            </div>

            <OvertimeTracker employeeId={employeeId} category={employeeView.category} />
        </div>
    );
}
