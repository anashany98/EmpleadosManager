import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Loader2, Save } from 'lucide-react';
import { hasModuleAccess, normalizeActor } from '@shared/authz';
import { toast } from 'sonner';
import { api } from '../../../api/client';
import { useAuth } from '../../../contexts/AuthContext';
import { EmployeeVacationWorkspace } from '../../self-service/vacations/EmployeeVacationWorkspace';
import { getVacationBalanceWithCache, invalidateVacationBalanceCache } from '../../self-service/vacations/vacationBalanceCache';
import type { EmployeeVacationBalanceSummary, EmployeeViewRecord } from '../types';

interface EmployeeVacationSectionProps {
    employeeId: string;
    employeeView: EmployeeViewRecord;
    onVacationBalanceChange: (vacationBalance: EmployeeVacationBalanceSummary) => void;
}

type ApiResponse<T> = {
    data?: T;
    message?: string;
    success?: boolean;
};

type VacationBalanceFormState = {
    annualQuotaDays: string;
    carriedOverDays: string;
    importedUsedDays: string;
};

function extractResponseData<T>(response: T | ApiResponse<T>): T | undefined {
    if (response && typeof response === 'object' && 'data' in response) {
        return (response as ApiResponse<T>).data;
    }

    return response as T;
}

function toFormState(balance?: EmployeeVacationBalanceSummary | null): VacationBalanceFormState {
    return {
        annualQuotaDays: balance ? String(balance.annualQuotaDays) : '30',
        carriedOverDays: balance ? String(balance.carriedOverDays) : '0',
        importedUsedDays: balance ? String(balance.importedUsedDays) : '0'
    };
}

export function EmployeeVacationSection({ employeeId, employeeView, onVacationBalanceChange }: EmployeeVacationSectionProps) {
    const { user } = useAuth();
    const actor = useMemo(() => normalizeActor(user), [user]);
    const canEditBalance = Boolean(actor && actor.role !== 'employee' && hasModuleAccess(actor, 'employees', 'write'));
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(employeeView.vacationBalance?.year ?? currentYear);
    const [balance, setBalance] = useState<EmployeeVacationBalanceSummary | null>(employeeView.vacationBalance ?? null);
    const [formState, setFormState] = useState<VacationBalanceFormState>(toFormState(employeeView.vacationBalance));
    const [loadingBalance, setLoadingBalance] = useState(false);
    const [savingBalance, setSavingBalance] = useState(false);

    const applyBalance = useCallback((nextBalance: EmployeeVacationBalanceSummary) => {
        setBalance(nextBalance);
        setFormState(toFormState(nextBalance));
        if (nextBalance.year === currentYear) {
            onVacationBalanceChange(nextBalance);
        }
    }, [currentYear, onVacationBalanceChange]);

    const fetchBalance = useCallback(async (year: number) => {
        setLoadingBalance(true);
        try {
            const nextBalance = await getVacationBalanceWithCache(employeeId, year, async () => {
                const response = await api.get<ApiResponse<EmployeeVacationBalanceSummary>>(`/employees/${employeeId}/vacation-balance`, {
                    params: { year }
                });
                const loadedBalance = extractResponseData<EmployeeVacationBalanceSummary>(response);
                if (!loadedBalance) {
                    throw new Error('Saldo de vacaciones no disponible');
                }
                return loadedBalance;
            });
            applyBalance(nextBalance);
        } catch (error) {
            console.error(error);
            toast.error('No se pudo cargar el saldo anual de vacaciones');
        } finally {
            setLoadingBalance(false);
        }
    }, [applyBalance, employeeId]);

    // Debounced fetch to avoid rate limiting
    const debounceTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null);

    const debouncedFetchBalance = useCallback((year: number) => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
        debounceTimer.current = setTimeout(() => {
            void fetchBalance(year);
        }, 1000); // 1s delay to avoid rate limiting
    }, [fetchBalance]);

    useEffect(() => {
        if (employeeView.vacationBalance?.year === selectedYear) {
            return;
        }

        debouncedFetchBalance(selectedYear);
        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, [debouncedFetchBalance, employeeView.vacationBalance?.year, selectedYear]);

    useEffect(() => {
        if (employeeView.vacationBalance?.year === selectedYear) {
            setBalance(employeeView.vacationBalance);
            setFormState(toFormState(employeeView.vacationBalance));
        }
    }, [employeeView.vacationBalance, selectedYear]);

    const handleSaveBalance = async () => {
        setSavingBalance(true);
        try {
            const response = await api.put<ApiResponse<EmployeeVacationBalanceSummary>>(`/employees/${employeeId}/vacation-balance`, {
                year: selectedYear,
                annualQuotaDays: Number(formState.annualQuotaDays || 0),
                carriedOverDays: Number(formState.carriedOverDays || 0),
                importedUsedDays: Number(formState.importedUsedDays || 0)
            });
            const nextBalance = extractResponseData<EmployeeVacationBalanceSummary>(response);
            if (!nextBalance) {
                throw new Error('No se pudo guardar el saldo de vacaciones');
            }

            applyBalance(nextBalance);
            invalidateVacationBalanceCache(employeeId, selectedYear);
            toast.success(response.message || 'Saldo de vacaciones actualizado');
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : 'Error al guardar el saldo de vacaciones');
        } finally {
            setSavingBalance(false);
        }
    };

    const yearOptions = [selectedYear - 1, selectedYear, selectedYear + 1]
        .filter((value, index, values) => values.indexOf(value) === index)
        .sort((left, right) => left - right);

    return (
        <div className="space-y-8">
            <div className="rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.25em] text-indigo-500">Balance anual</p>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-2">Vacaciones del ejercicio</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Controla cupo anual, arrastre y gasto importado para el año seleccionado.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <CalendarDays size={18} className="text-slate-400" />
                        <select
                            value={selectedYear}
                            onChange={(event) => setSelectedYear(Number(event.target.value))}
                            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
                        >
                            {yearOptions.map((year) => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {loadingBalance ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-10 text-center text-slate-500 flex items-center justify-center gap-3">
                            <Loader2 size={18} className="animate-spin" /> Cargando balance...
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                                <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4">
                                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400 font-black">Cupo total</div>
                                    <div className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{balance?.totalEntitledDays ?? 0}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-amber-50/70 dark:bg-amber-900/10 p-4">
                                    <div className="text-xs uppercase tracking-[0.2em] text-amber-500 font-black">Arrastradas</div>
                                    <div className="mt-3 text-3xl font-black text-amber-600 dark:text-amber-300">{balance?.carriedOverDays ?? 0}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-rose-50/70 dark:bg-rose-900/10 p-4">
                                    <div className="text-xs uppercase tracking-[0.2em] text-rose-500 font-black">Usadas</div>
                                    <div className="mt-3 text-3xl font-black text-rose-600 dark:text-rose-300">{balance ? balance.importedUsedDays + balance.approvedUsedDays : 0}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-emerald-50/70 dark:bg-emerald-900/10 p-4">
                                    <div className="text-xs uppercase tracking-[0.2em] text-emerald-500 font-black">Saldo proyectado</div>
                                    <div className="mt-3 text-3xl font-black text-emerald-600 dark:text-emerald-300">{balance?.projectedAvailableDays ?? 0}</div>
                                </div>
                            </div>

                            <div className={`grid grid-cols-1 gap-6 items-start ${canEditBalance ? 'xl:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
                                <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 p-5">
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                        <div>
                                            <p className="text-slate-400 uppercase tracking-[0.18em] text-[11px] font-black">Anuales</p>
                                            <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{balance?.annualQuotaDays ?? 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-400 uppercase tracking-[0.18em] text-[11px] font-black">Importadas</p>
                                            <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{balance?.importedUsedDays ?? 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-400 uppercase tracking-[0.18em] text-[11px] font-black">Aprobadas</p>
                                            <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{balance?.approvedUsedDays ?? 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-400 uppercase tracking-[0.18em] text-[11px] font-black">Pendientes</p>
                                            <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{balance?.pendingDays ?? 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-400 uppercase tracking-[0.18em] text-[11px] font-black">Saldo actual</p>
                                            <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{balance?.availableDays ?? 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-400 uppercase tracking-[0.18em] text-[11px] font-black">Año</p>
                                            <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{balance?.year ?? selectedYear}</p>
                                        </div>
                                    </div>
                                </div>

                                {canEditBalance ? (
                                    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-sm space-y-4">
                                        <div>
                                            <h4 className="text-base font-black text-slate-900 dark:text-white">Ajuste manual</h4>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                                Usa la fecha de entrada para el prorrateo inicial y ajusta aquí el ejercicio real.
                                            </p>
                                        </div>
                                        <label className="block space-y-1">
                                            <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Vacaciones anuales</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={formState.annualQuotaDays}
                                                onChange={(event) => setFormState((current) => ({ ...current, annualQuotaDays: event.target.value }))}
                                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 font-semibold text-slate-800 dark:text-slate-100"
                                            />
                                        </label>
                                        <label className="block space-y-1">
                                            <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Vacaciones arrastradas</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={formState.carriedOverDays}
                                                onChange={(event) => setFormState((current) => ({ ...current, carriedOverDays: event.target.value }))}
                                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 font-semibold text-slate-800 dark:text-slate-100"
                                            />
                                        </label>
                                        <label className="block space-y-1">
                                            <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Vacaciones gastadas</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={formState.importedUsedDays}
                                                onChange={(event) => setFormState((current) => ({ ...current, importedUsedDays: event.target.value }))}
                                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 font-semibold text-slate-800 dark:text-slate-100"
                                            />
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => void handleSaveBalance()}
                                            disabled={savingBalance}
                                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-700 disabled:opacity-60"
                                        >
                                            {savingBalance ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                            Guardar balance {selectedYear}
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <EmployeeVacationWorkspace employeeId={employeeId} />
        </div>
    );
}
