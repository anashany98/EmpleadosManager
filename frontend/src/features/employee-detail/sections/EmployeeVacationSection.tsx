import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    CalendarDays,
    Check,
    Edit3,
    Loader2,
    Plane,
    Plus,
    Save,
    Sparkles,
    Sun,
    TrendingUp,
    Wallet
} from 'lucide-react';
import { hasModuleAccess, normalizeActor } from '@shared/authz';
import { motion } from 'framer-motion';
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

// ── Visual KPI Card ──────────────────────────────────────────────
interface KpiCardProps {
    label: string;
    value: number | string;
    icon: typeof Plane;
    gradient: string;
    iconBg: string;
    iconColor: string;
    trend?: string;
}

function KpiCard({ label, value, icon: Icon, gradient, iconBg, iconColor, trend }: KpiCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`relative overflow-hidden rounded-2xl p-4 ${gradient}`}
        >
            <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-xl ${iconBg}`}>
                    <Icon size={18} className={iconColor} />
                </div>
                {trend && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {trend}
                    </span>
                )}
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300 mb-1">
                {label}
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                {value}
            </div>
        </motion.div>
    );
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
    const [isEditing, setIsEditing] = useState(false);

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

    const debounceTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null);

    const debouncedFetchBalance = useCallback((year: number) => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
        debounceTimer.current = setTimeout(() => {
            void fetchBalance(year);
        }, 800);
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
            setIsEditing(false);
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

    // ── Derived metrics for visual elements ──────────────────
    const total = balance?.totalEntitledDays ?? 0;
    const used = balance ? balance.importedUsedDays + balance.approvedUsedDays : 0;
    const pending = balance?.pendingDays ?? 0;
    const available = balance?.projectedAvailableDays ?? 0;
    const usedPercentage = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

    return (
        <div className="space-y-6">
            {/* ═══════════════ HERO BALANCE CARD ═══════════════ */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-6 sm:p-8 text-white shadow-2xl shadow-indigo-500/20"
            >
                {/* Decorative blobs */}
                <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
                <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-pink-500/20 blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles size={16} className="text-amber-300" />
                            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-100">
                                Balance de vacaciones {selectedYear}
                            </span>
                        </div>
                        <div className="flex items-baseline gap-3 mb-4">
                            <h2 className="text-6xl sm:text-7xl font-black tabular-nums leading-none">
                                {available}
                            </h2>
                            <span className="text-xl font-bold text-indigo-100">días libres</span>
                        </div>
                        <p className="text-sm text-indigo-100/80 max-w-md">
                            Te quedan <span className="font-bold text-white">{available}</span> días paraDisfruta · {pending > 0 && (
                                <span>{pending} día{pending > 1 ? 's' : ''} pendiente{pending > 1 ? 's' : ''} de aprobación</span>
                            )}
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 lg:items-end min-w-[180px]">
                        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-100">
                            Año fiscal
                        </div>
                        <div className="flex items-center bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-1">
                            {yearOptions.map((year) => (
                                <button
                                    key={year}
                                    onClick={() => setSelectedYear(year)}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-black transition-all ${
                                        selectedYear === year
                                            ? 'bg-white text-indigo-700 shadow-md'
                                            : 'text-white/70 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    {year}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="relative z-10 mt-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-indigo-100">
                            Usado
                        </span>
                        <span className="text-sm font-black text-white tabular-nums">
                            {used} / {total} días ({usedPercentage}%)
                        </span>
                    </div>
                    <div className="w-full h-3 bg-white/15 rounded-full overflow-hidden backdrop-blur-sm">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${usedPercentage}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                            className="h-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 rounded-full shadow-lg"
                        />
                    </div>
                </div>
            </motion.div>

            {/* ═══════════════ KPI GRID ═══════════════ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    label="Cupo total"
                    value={`${total}`}
                    icon={Wallet}
                    gradient="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900"
                    iconBg="bg-slate-200 dark:bg-slate-700"
                    iconColor="text-slate-700 dark:text-slate-200"
                    trend={`${selectedYear}`}
                />
                <KpiCard
                    label="Arrastradas"
                    value={`${balance?.carriedOverDays ?? 0}`}
                    icon={TrendingUp}
                    gradient="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20"
                    iconBg="bg-amber-100 dark:bg-amber-800/40"
                    iconColor="text-amber-600 dark:text-amber-300"
                />
                <KpiCard
                    label="Días usados"
                    value={`${used}`}
                    icon={Plane}
                    gradient="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20"
                    iconBg="bg-rose-100 dark:bg-rose-800/40"
                    iconColor="text-rose-600 dark:text-rose-300"
                />
                <KpiCard
                    label="Pendientes"
                    value={`${pending}`}
                    icon={Sun}
                    gradient="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20"
                    iconBg="bg-emerald-100 dark:bg-emerald-800/40"
                    iconColor="text-emerald-600 dark:text-emerald-300"
                />
            </div>

            {/* ═══════════════ DETAIL BREAKDOWN & EDITOR ═══════════════ */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="grid grid-cols-1 gap-6 xl:grid-cols-3"
            >
                {/* Breakdown */}
                <div className="xl:col-span-2 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white">
                            Detalle del ejercicio {selectedYear}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Desglose de días anuales, importados, aprobados y pendientes.
                        </p>
                    </div>
                    <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-6">
                        {[
                            { label: 'Cupo anual', value: balance?.annualQuotaDays ?? 0, color: 'text-slate-700 dark:text-slate-200' },
                            { label: 'Importados', value: balance?.importedUsedDays ?? 0, color: 'text-amber-600 dark:text-amber-400' },
                            { label: 'Aprobados', value: balance?.approvedUsedDays ?? 0, color: 'text-emerald-600 dark:text-emerald-400' },
                            { label: 'Pendientes', value: balance?.pendingDays ?? 0, color: 'text-orange-600 dark:text-orange-400' },
                            { label: 'Saldo actual', value: balance?.availableDays ?? 0, color: 'text-indigo-600 dark:text-indigo-400' },
                            { label: 'Año', value: balance?.year ?? selectedYear, color: 'text-slate-700 dark:text-slate-200' }
                        ].map((item) => (
                            <div key={item.label} className="space-y-1">
                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                    {item.label}
                                </div>
                                <div className={`text-2xl font-black tabular-nums ${item.color}`}>
                                    {item.value}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Manual adjust / Read-only */}
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">
                                Ajuste manual
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Corrige el ejercicio real del empleado.
                            </p>
                        </div>
                        {canEditBalance && !isEditing && (
                            <button
                                type="button"
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition"
                            >
                                <Edit3 size={14} /> Editar
                            </button>
                        )}
                    </div>

                    <div className="p-6 space-y-4">
                        {loadingBalance ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-10 text-center text-slate-500 flex items-center justify-center gap-3">
                                <Loader2 size={18} className="animate-spin" /> Cargando balance...
                            </div>
                        ) : (
                            <>
                                <FieldInput
                                    label="Vacaciones anuales"
                                    value={formState.annualQuotaDays}
                                    disabled={!isEditing || !canEditBalance}
                                    onChange={(value) => setFormState((current) => ({ ...current, annualQuotaDays: value }))}
                                />
                                <FieldInput
                                    label="Vacaciones arrastradas"
                                    value={formState.carriedOverDays}
                                    disabled={!isEditing || !canEditBalance}
                                    onChange={(value) => setFormState((current) => ({ ...current, carriedOverDays: value }))}
                                />
                                <FieldInput
                                    label="Vacaciones gastadas (importadas)"
                                    value={formState.importedUsedDays}
                                    disabled={!isEditing || !canEditBalance}
                                    onChange={(value) => setFormState((current) => ({ ...current, importedUsedDays: value }))}
                                />

                                {canEditBalance && (
                                    <div className="flex gap-2 pt-2">
                                        {isEditing && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setFormState(toFormState(balance));
                                                        setIsEditing(false);
                                                    }}
                                                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                                                    disabled={savingBalance}
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleSaveBalance()}
                                                    disabled={savingBalance}
                                                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition disabled:opacity-60"
                                                >
                                                    {savingBalance ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                                    Guardar
                                                </button>
                                            </>
                                        )}
                                        {!isEditing && (
                                            <div className="w-full flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                <Check size={14} className="text-emerald-500" />
                                                Balance sincronizado con el servidor
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* ═══════════════ WORKSPACE (solicitudes + calendario) ═══════════════ */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
            >
                <EmployeeVacationWorkspace employeeId={employeeId} />
            </motion.div>
        </div>
    );
}

// ── Helper field input ──────────────────────────────────────────────
interface FieldInputProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

function FieldInput({ label, value, onChange, disabled }: FieldInputProps) {
    return (
        <label className="block space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                {label}
            </span>
            <input
                type="number"
                min="0"
                step="0.01"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                disabled={disabled}
                className={`w-full rounded-xl border px-4 py-2.5 font-bold text-slate-800 dark:text-slate-100 transition ${
                    disabled
                        ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-500 cursor-not-allowed'
                        : 'border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none'
                }`}
            />
        </label>
    );
}