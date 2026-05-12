import { useCallback, useMemo, useState } from 'react';
import { Filter } from 'lucide-react';
import { ABSENCE_TYPES, DAY_NAMES, isVacationToday, type VacationRequest } from './types';

interface VacationCalendarViewProps {
    vacations: VacationRequest[];
    title: string;
    scopeLabel: string;
    showDepartmentFilter?: boolean;
    departments?: string[];
    selectedDepartment?: string;
    onDepartmentChange?: (department: string) => void;
    onSelectRequest: (request: VacationRequest) => void;
    isLoading?: boolean;
    currentDate?: Date;
    onCurrentDateChange?: (date: Date) => void;
}

export function VacationCalendarView({
    vacations,
    title,
    scopeLabel,
    showDepartmentFilter = false,
    departments = [],
    selectedDepartment = 'ALL',
    onDepartmentChange,
    onSelectRequest,
    isLoading = false,
    currentDate: externalCurrentDate,
    onCurrentDateChange
}: VacationCalendarViewProps) {
    const [internalDate, setInternalDate] = useState(new Date());
    const currentDate = externalCurrentDate ?? internalDate;
    const setCurrentDate = onCurrentDateChange ?? setInternalDate;

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const referenceDate = new Date();

    const getDayEvents = useCallback((day: number) => {
        const target = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const targetTime = target.getTime();

        return vacations.filter((vacation) => {
            const start = new Date(vacation.startDate).setHours(0, 0, 0, 0);
            const end = new Date(vacation.endDate).setHours(23, 59, 59, 999);
            return targetTime >= start && targetTime <= end;
        });
    }, [vacations, currentDate]);

    const renderedDays = useMemo(() => {
        return Array.from({ length: daysInMonth }).map((_, index) => {
            const day = index + 1;
            const events = getDayEvents(day);
            const weekdayPosition = offset + day;
            const isWeekend = weekdayPosition % 7 === 0 || weekdayPosition % 7 === 6;
            const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const isToday = isVacationToday(cellDate, referenceDate);

            return { day, events, isWeekend, isToday, cellDate };
        });
    }, [daysInMonth, offset, getDayEvents, currentDate]);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden p-6">
            <div className="flex justify-between items-center mb-6 gap-4">
                <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">{title}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{scopeLabel}</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 rounded-xl p-1">
                        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all shadow-sm">
                            <span className="text-xs">{'<'}</span>
                        </button>
                        <span className="px-4 font-bold text-slate-700 dark:text-slate-200 min-w-[160px] text-center capitalize">
                            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </span>
                        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all shadow-sm">
                            <span className="text-xs">{'>'}</span>
                        </button>
                    </div>

                    {showDepartmentFilter && onDepartmentChange && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800">
                            <Filter size={14} className="text-slate-400" />
                            <select
                                value={selectedDepartment}
                                onChange={(event) => onDepartmentChange(event.target.value)}
                                className="bg-transparent text-[10px] font-bold outline-none text-slate-700 dark:text-slate-200"
                            >
                                <option value="ALL">TODOS LOS DEPTOS.</option>
                                {departments.map((department) => (
                                    <option key={department} value={department}>
                                        {department.toUpperCase()}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-7 mb-2">
                {DAY_NAMES.map((day, index) => (
                    <div key={day} className={`text-center py-2 text-[10px] font-bold uppercase tracking-widest ${index >= 5 ? 'text-rose-500/70' : 'text-slate-400'}`}>
                        {day}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-2 min-h-[600px] auto-rows-fr">
                {isLoading ? (
                    <>
                        {Array.from({ length: offset }).map((_, index) => (
                            <div key={`skeleton-empty-${index}`} className="bg-slate-100/50 dark:bg-slate-800/20 rounded-xl animate-pulse" />
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, index) => (
                            <div key={`skeleton-day-${index}`} className="bg-slate-100/50 dark:bg-slate-800/20 rounded-xl animate-pulse" />
                        ))}
                    </>
                ) : (
                    <>
                        {Array.from({ length: offset }).map((_, index) => (
                            <div key={`empty-${index}`} className="bg-slate-50/50 dark:bg-slate-800/20 rounded-xl" />
                        ))}

                        {renderedDays.map(({ day, events, isWeekend, isToday, cellDate }) => {
                            const config = ABSENCE_TYPES[event.type] || ABSENCE_TYPES.VACATION;
                            return (
                                <div
                                    key={day}
                                    className={`relative p-2 rounded-xl border flex flex-col gap-1 transition-all h-full min-h-[100px] ${isToday ? 'bg-indigo-50/50 border-indigo-200 dark:bg-indigo-900/10 dark:border-indigo-800' : 'bg-transparent border-slate-100 dark:border-slate-800'} ${isWeekend ? 'bg-slate-50/50 dark:bg-slate-900/50' : ''}`}
                                >
                                    <span className={`text-xs font-bold ${isToday ? 'text-indigo-600' : 'text-slate-500 dark:text-slate-400'}`}>{day}</span>

                                    <div className="flex flex-col gap-1 overflow-y-auto max-h-[120px] custom-scrollbar">
                                        {events.map((event) => {
                                            const eventConfig = ABSENCE_TYPES[event.type] || ABSENCE_TYPES.VACATION;
                                            const stateClass =
                                                event.status === 'PENDING'
                                                    ? 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200'
                                                    : event.status === 'REJECTED'
                                                        ? 'bg-slate-100 text-slate-500 border-slate-200 opacity-60 hover:opacity-100'
                                                        : `${eventConfig.bgSoft} ${eventConfig.text} ${eventConfig.border} hover:brightness-95`;

                                            return (
                                                <button
                                                    key={event.id}
                                                    onClick={(actionEvent) => {
                                                        actionEvent.stopPropagation();
                                                        onSelectRequest(event);
                                                    }}
                                                    className={`w-full text-left px-1.5 py-1 rounded-md text-[9px] font-bold truncate flex items-center gap-1 border transition-all ${stateClass}`}
                                                >
                                                    <div className={`w-1.5 h-1.5 rounded-full ${event.status === 'PENDING' ? 'bg-amber-500 animate-pulse' : event.status === 'REJECTED' ? 'bg-slate-400' : eventConfig.color}`} />
                                                    {(event.employee?.name || 'Yo').split(' ')[0]}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </>
                )}
            </div>
        </div>
    );
}
