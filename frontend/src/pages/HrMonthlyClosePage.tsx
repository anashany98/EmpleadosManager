import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    CalendarCheck,
    Check,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Lock,
    LockOpen,
    Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { hrOperationsApi } from '../features/hr-operations/api';
import { CompanyScopeSelect } from '../features/hr-operations/components/CompanyScopeSelect';
import type { MonthlyCloseItem } from '../features/hr-operations/types';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function periodShift(year: number, month: number, amount: number) {
    const date = new Date(year, month - 1 + amount, 1);
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function CloseItemRow({
    item,
    locked,
    saving,
    onToggle,
    onOpen
}: {
    item: MonthlyCloseItem;
    locked: boolean;
    saving: boolean;
    onToggle: () => void;
    onOpen: () => void;
}) {
    return (
        <div className={`group grid gap-4 px-5 py-5 transition-colors sm:grid-cols-[auto_1fr_auto] sm:items-center ${item.completed ? 'bg-emerald-50/45 dark:bg-emerald-950/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}>
            <button
                type="button"
                disabled={locked || saving || item.blocking}
                onClick={onToggle}
                aria-label={`${item.completed ? 'Marcar pendiente' : 'Marcar completado'}: ${item.label}`}
                className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed ${item.completed ? 'border-emerald-500 bg-emerald-500 text-white' : item.blocking ? 'border-rose-200 bg-rose-50 text-rose-500 dark:border-rose-900 dark:bg-rose-950/30' : 'border-slate-300 bg-white text-transparent hover:border-blue-500 dark:border-slate-700 dark:bg-slate-900'}`}
            >
                {saving ? <Loader2 size={18} className="animate-spin text-blue-500" /> : item.blocking ? <AlertCircle size={18} /> : <Check size={19} />}
            </button>
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <h3 className={`font-black ${item.completed ? 'text-emerald-900 dark:text-emerald-200' : 'text-slate-950 dark:text-white'}`}>{item.label}</h3>
                    {item.required ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:bg-slate-800">Obligatorio</span>
                    ) : (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">Recomendado</span>
                    )}
                </div>
                <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{item.description}</p>
                {item.metric > 0 && (
                    <p className={`mt-2 text-xs font-black ${item.blocking ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {item.metric} elemento{item.metric === 1 ? '' : 's'} por revisar
                    </p>
                )}
            </div>
            <button type="button" onClick={onOpen} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-blue-600 hover:bg-blue-50 sm:justify-start dark:text-blue-400 dark:hover:bg-blue-950/30">
                Revisar <ArrowRight size={15} />
            </button>
        </div>
    );
}

export default function HrMonthlyClosePage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const now = new Date();
    const isGlobalAdmin = user?.role === 'admin' && !user.companyId;
    const [companyId, setCompanyId] = useState(user?.companyId || '');
    const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
    const [notes, setNotes] = useState('');
    const [savingItem, setSavingItem] = useState<string | null>(null);
    const companiesQuery = useQuery({
        queryKey: ['companies', 'hr-close'],
        queryFn: hrOperationsApi.companies,
        enabled: isGlobalAdmin
    });
    useEffect(() => {
        if (isGlobalAdmin && !companyId && companiesQuery.data?.[0]) setCompanyId(companiesQuery.data[0].id);
    }, [companiesQuery.data, companyId, isGlobalAdmin]);
    const closeQuery = useQuery({
        queryKey: ['hr-monthly-close', companyId, period.year, period.month],
        queryFn: () => hrOperationsApi.monthlyClose(companyId || undefined, period.year, period.month),
        enabled: Boolean(companyId || !isGlobalAdmin)
    });
    useEffect(() => setNotes(closeQuery.data?.notes || ''), [closeQuery.data?.notes]);
    const itemMutation = useMutation({
        mutationFn: ({ id, key, completed }: { id: string; key: string; completed: boolean }) => hrOperationsApi.updateCloseItem(id, key, completed),
        onMutate: ({ key }) => setSavingItem(key),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr-monthly-close'] }),
        onError: (error) => toast.error(getErrorMessage(error, 'No se pudo actualizar la comprobación')),
        onSettled: () => setSavingItem(null)
    });
    const statusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: 'OPEN' | 'CLOSED' }) => hrOperationsApi.setCloseStatus(id, status, notes),
        onSuccess: (_, variables) => {
            toast.success(variables.status === 'CLOSED' ? 'Mes cerrado correctamente' : 'Mes reabierto');
            queryClient.invalidateQueries({ queryKey: ['hr-monthly-close'] });
        },
        onError: (error) => toast.error(getErrorMessage(error, 'No se pudo cambiar el estado del cierre'))
    });

    const close = closeQuery.data;
    const items = close?.items || [];
    const required = items.filter((item) => item.required);
    const completedRequired = required.filter((item) => item.completed).length;
    const progress = required.length ? Math.round((completedRequired / required.length) * 100) : 0;
    const blockers = items.filter((item) => item.blocking && !item.completed);
    const canClose = required.length > 0 && completedRequired === required.length;
    const periodLabel = `${MONTHS[period.month - 1]} ${period.year}`;

    const sections = useMemo(() => [
        { label: 'Personas y tiempo', keys: ['ATTENDANCE', 'ABSENCES', 'LIFECYCLE', 'TASKS'] },
        { label: 'Economía y documentación', keys: ['EXPENSES', 'PAYROLL', 'DOCUMENTS', 'GESTORIA'] }
    ], []);

    return (
        <div className="space-y-6">
            <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-5 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                            <CalendarCheck size={18} />
                            <p className="text-xs font-black uppercase tracking-[0.2em]">Control de periodo</p>
                        </div>
                        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Cierre mensual de RRHH</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Una revisión ordenada para entregar nóminas y gestoría sin incidencias olvidadas.
                        </p>
                    </div>
                    <CompanyScopeSelect companies={companiesQuery.data || []} value={companyId} onChange={setCompanyId} hidden={!isGlobalAdmin} />
                </div>
                <div className="grid border-t border-slate-100 lg:grid-cols-[auto_1fr_auto] dark:border-slate-800">
                    <div className="flex items-center justify-center gap-2 px-5 py-4">
                        <button type="button" onClick={() => setPeriod((current) => periodShift(current.year, current.month, -1))} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:bg-slate-800" aria-label="Mes anterior"><ChevronLeft size={20} /></button>
                        <div className="min-w-44 text-center">
                            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Periodo</p>
                            <p className="mt-0.5 text-lg font-black capitalize text-slate-900 dark:text-white">{periodLabel}</p>
                        </div>
                        <button type="button" onClick={() => setPeriod((current) => periodShift(current.year, current.month, 1))} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:bg-slate-800" aria-label="Mes siguiente"><ChevronRight size={20} /></button>
                    </div>
                    <div className="border-y border-slate-100 px-6 py-4 lg:border-x lg:border-y-0 dark:border-slate-800">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-bold text-slate-600 dark:text-slate-300">{completedRequired} de {required.length} comprobaciones</span>
                            <span className="font-black text-slate-900 dark:text-white">{progress}%</span>
                        </div>
                        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-3 px-6 py-4">
                        {close?.status === 'CLOSED' ? (
                            <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-50 px-4 text-sm font-black text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"><Lock size={16} />Periodo cerrado</span>
                        ) : blockers.length ? (
                            <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-50 px-4 text-sm font-black text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"><AlertCircle size={16} />{blockers.length} bloqueos</span>
                        ) : (
                            <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-50 px-4 text-sm font-black text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"><ClipboardList size={16} />En revisión</span>
                        )}
                    </div>
                </div>
            </header>

            {closeQuery.isLoading ? (
                <div className="space-y-4 animate-pulse">{[1, 2].map((item) => <div key={item} className="h-72 rounded-3xl bg-slate-200 dark:bg-slate-800" />)}</div>
            ) : !close ? (
                <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-500 dark:border-slate-700">Selecciona una empresa para abrir el cierre mensual.</div>
            ) : (
                <>
                    {sections.map((section) => {
                        const sectionItems = items.filter((item) => section.keys.includes(item.key));
                        if (!sectionItems.length) return null;
                        return (
                            <section key={section.label} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                                    <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">{section.label}</h2>
                                    <span className="text-xs font-bold text-slate-400">{sectionItems.filter((item) => item.completed).length}/{sectionItems.length}</span>
                                </div>
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {sectionItems.map((item) => (
                                        <CloseItemRow
                                            key={item.key}
                                            item={item}
                                            locked={close.status === 'CLOSED'}
                                            saving={savingItem === item.key}
                                            onToggle={() => itemMutation.mutate({ id: close.id, key: item.key, completed: !item.completed })}
                                            onOpen={() => navigate(item.actionUrl)}
                                        />
                                    ))}
                                </div>
                            </section>
                        );
                    })}

                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <label>
                            <span className="text-sm font-black text-slate-900 dark:text-white">Notas del cierre</span>
                            <span className="mt-1 block text-sm text-slate-500">Deja constancia de excepciones, acuerdos o información enviada a gestoría.</span>
                            <textarea
                                value={notes}
                                onChange={(event) => setNotes(event.target.value)}
                                disabled={close.status === 'CLOSED'}
                                rows={3}
                                className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                placeholder="Ej.: pendiente confirmar una dieta con la gestoría…"
                            />
                        </label>
                        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-slate-500">
                                {close.status === 'CLOSED'
                                    ? `Cerrado ${close.closedAt ? new Date(close.closedAt).toLocaleString('es-ES') : ''}${close.closedBy?.email ? ` por ${close.closedBy.email}` : ''}.`
                                    : canClose
                                        ? 'Todas las comprobaciones obligatorias están completas.'
                                        : `Faltan ${required.length - completedRequired} comprobaciones obligatorias.`}
                            </p>
                            {close.status === 'CLOSED' ? (
                                <button type="button" onClick={() => statusMutation.mutate({ id: close.id, status: 'OPEN' })} disabled={statusMutation.isPending} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                                    <LockOpen size={17} />Reabrir periodo
                                </button>
                            ) : (
                                <button type="button" onClick={() => statusMutation.mutate({ id: close.id, status: 'CLOSED' })} disabled={!canClose || statusMutation.isPending} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 font-black text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">
                                    {statusMutation.isPending ? <Loader2 size={17} className="animate-spin" /> : <Lock size={17} />}
                                    Cerrar {periodLabel}
                                </button>
                            )}
                        </div>
                    </section>
                </>
            )}

            <div className="flex justify-between">
                <button type="button" onClick={() => setPeriod((current) => periodShift(current.year, current.month, -1))} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><ArrowLeft size={15} />Mes anterior</button>
                <button type="button" onClick={() => setPeriod((current) => periodShift(current.year, current.month, 1))} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Mes siguiente<ArrowRight size={15} /></button>
            </div>
        </div>
    );
}
