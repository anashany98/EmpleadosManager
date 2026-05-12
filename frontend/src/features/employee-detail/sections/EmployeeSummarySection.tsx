import { OvertimeTracker } from './OvertimeTracker';
import type { EmployeeViewRecord } from '../types';

export function EmployeeSummarySection({ employeeId, employeeView }: { employeeId: string; employeeView: EmployeeViewRecord }) {
    const vacationBalance = employeeView.vacationBalance;

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <p className="text-slate-500 text-sm font-medium mb-1">Subcuenta Contable</p>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{employeeView.subaccount465}</h3>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <p className="text-slate-500 text-sm font-medium mb-1">Saldo Vacaciones</p>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{vacationBalance?.availableDays ?? employeeView.vacationDaysTotal ?? 30} días</h3>
                    {vacationBalance ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            {vacationBalance.totalEntitledDays} total · {vacationBalance.carriedOverDays} arrastrados · {vacationBalance.importedUsedDays + vacationBalance.approvedUsedDays} usados
                        </p>
                    ) : null}
                </div>
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
