import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowRight,
    CalendarClock,
    Check,
    CheckCircle2,
    ClipboardCheck,
    Clock3,
    Filter,
    ListTodo,
    Loader2,
    Plus,
    RefreshCw,
    Sparkles,
    UserRound,
    X
} from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { hrOperationsApi } from '../features/hr-operations/api';
import { CompanyScopeSelect } from '../features/hr-operations/components/CompanyScopeSelect';
import type { HrTask } from '../features/hr-operations/types';

const PRIORITY = {
    URGENT: { label: 'Urgente', dot: 'bg-rose-600', badge: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900' },
    HIGH: { label: 'Alta', dot: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-900' },
    MEDIUM: { label: 'Media', dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900' },
    LOW: { label: 'Normal', dot: 'bg-sky-500', badge: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900' }
} as const;

const CATEGORY_LABELS: Record<string, string> = {
    GENERAL: 'General',
    CONTRACTS: 'Contratos',
    DOCUMENTS: 'Documentación',
    ABSENCES: 'Ausencias',
    PAYROLL: 'Nóminas',
    ONBOARDING: 'Altas',
    OFFBOARDING: 'Bajas'
};

function taskEmployeeName(task: HrTask) {
    if (!task.employee) return null;
    return `${task.employee.firstName || task.employee.name || ''} ${task.employee.lastName || ''}`.trim();
}

function dueLabel(dateValue?: string | null) {
    if (!dateValue) return { text: 'Sin fecha límite', overdue: false };
    const date = new Date(dateValue);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.ceil((date.getTime() - today.getTime()) / 86400000);
    if (days < 0) return { text: `Vencida hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}`, overdue: true };
    if (days === 0) return { text: 'Vence hoy', overdue: false };
    if (days === 1) return { text: 'Vence mañana', overdue: false };
    if (days <= 7) return { text: `Vence en ${days} días`, overdue: false };
    return { text: date.toLocaleDateString('es-ES'), overdue: false };
}

function TaskCreateDialog({
    companyId,
    onClose,
    onCreated
}: {
    companyId?: string;
    onClose: () => void;
    onCreated: () => void;
}) {
    const [form, setForm] = useState({
        title: '',
        description: '',
        category: 'GENERAL',
        priority: 'MEDIUM',
        dueDate: ''
    });
    const mutation = useMutation({
        mutationFn: () => hrOperationsApi.createTask({ ...form, companyId }),
        onSuccess: () => {
            toast.success('Tarea creada');
            onCreated();
            onClose();
        },
        onError: (error) => toast.error(getErrorMessage(error, 'No se pudo crear la tarea'))
    });

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="new-hr-task-title">
            <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Nueva tarea</p>
                        <h2 id="new-hr-task-title" className="mt-1 text-xl font-black text-slate-950 dark:text-white">Añadir un pendiente de RRHH</h2>
                    </div>
                    <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:bg-slate-800" aria-label="Cerrar">
                        <X size={20} />
                    </button>
                </div>
                <form
                    className="space-y-5 p-6"
                    onSubmit={(event) => {
                        event.preventDefault();
                        mutation.mutate();
                    }}
                >
                    <label className="block">
                        <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">Qué hay que hacer</span>
                        <input
                            autoFocus
                            required
                            minLength={3}
                            value={form.title}
                            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                            placeholder="Ej.: Revisar renovación del contrato"
                            className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">Información útil</span>
                        <textarea
                            value={form.description}
                            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                            rows={3}
                            placeholder="Añade el contexto necesario para resolverla."
                            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <label>
                            <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">Área</span>
                            <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                                {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                        </label>
                        <label>
                            <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">Prioridad</span>
                            <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                                {Object.entries(PRIORITY).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}
                            </select>
                        </label>
                        <label>
                            <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">Fecha límite</span>
                            <input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                        </label>
                    </div>
                    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                        <button type="button" onClick={onClose} className="min-h-11 rounded-xl px-5 font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancelar</button>
                        <button disabled={mutation.isPending || form.title.trim().length < 3} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50">
                            {mutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                            Crear tarea
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function HrTaskCenterPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const isGlobalAdmin = user?.role === 'admin' && !user.companyId;
    const [companyId, setCompanyId] = useState(user?.companyId || '');
    const [priority, setPriority] = useState('ALL');
    const [category, setCategory] = useState('ALL');
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const syncedCompany = useRef<string | null>(null);

    const companiesQuery = useQuery({
        queryKey: ['companies', 'hr-scope'],
        queryFn: hrOperationsApi.companies,
        enabled: isGlobalAdmin
    });
    useEffect(() => {
        if (isGlobalAdmin && !companyId && companiesQuery.data?.[0]) setCompanyId(companiesQuery.data[0].id);
    }, [companiesQuery.data, companyId, isGlobalAdmin]);

    const overviewQuery = useQuery({
        queryKey: ['hr-task-overview', companyId, priority, category],
        queryFn: () => hrOperationsApi.overview({
            companyId: companyId || undefined,
            priority,
            category
        }),
        enabled: Boolean(companyId || !isGlobalAdmin),
        refetchInterval: 60_000
    });
    const syncMutation = useMutation({
        mutationFn: () => hrOperationsApi.sync(companyId || undefined),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['hr-task-overview'] });
            if (syncedCompany.current) toast.success(`${result.synchronized} pendientes automáticos revisados`);
            syncedCompany.current = companyId || user?.companyId || 'default';
        },
        onError: (error) => toast.error(getErrorMessage(error, 'No se pudieron sincronizar las tareas'))
    });
    useEffect(() => {
        const key = companyId || user?.companyId;
        if (key && syncedCompany.current !== key && !syncMutation.isPending) {
            syncedCompany.current = key;
            syncMutation.mutate();
        }
    }, [companyId, syncMutation, user?.companyId]);

    const updateMutation = useMutation({
        mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => hrOperationsApi.updateTask(id, body),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr-task-overview'] }),
        onError: (error) => toast.error(getErrorMessage(error, 'No se pudo actualizar la tarea'))
    });

    const data = overviewQuery.data;
    const tasks = data?.tasks || [];
    const selectedTask = tasks.find((task) => task.id === selectedTaskId) || tasks[0] || null;
    useEffect(() => {
        if (!selectedTaskId && tasks[0]) setSelectedTaskId(tasks[0].id);
        if (selectedTaskId && !tasks.some((task) => task.id === selectedTaskId)) setSelectedTaskId(tasks[0]?.id || null);
    }, [selectedTaskId, tasks]);

    const groupedTasks = useMemo(() => {
        const now = new Date();
        const urgent: HrTask[] = [];
        const soon: HrTask[] = [];
        const later: HrTask[] = [];
        tasks.forEach((task) => {
            const due = task.dueDate ? new Date(task.dueDate) : null;
            if (task.priority === 'URGENT' || task.priority === 'HIGH' || (due && due < now)) urgent.push(task);
            else if (due && due.getTime() <= now.getTime() + 7 * 86400000) soon.push(task);
            else later.push(task);
        });
        return [
            { key: 'priority', label: 'Resolver primero', tasks: urgent },
            { key: 'soon', label: 'Próximos 7 días', tasks: soon },
            { key: 'later', label: 'Después', tasks: later }
        ].filter((group) => group.tasks.length);
    }, [tasks]);

    return (
        <div className="space-y-6">
            <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 text-white shadow-xl shadow-slate-950/10">
                <div className="grid lg:grid-cols-[1fr_auto]">
                    <div className="p-6 sm:p-8">
                        <div className="flex items-center gap-2 text-blue-300">
                            <ClipboardCheck size={18} />
                            <p className="text-xs font-black uppercase tracking-[0.2em]">Mesa de operaciones</p>
                        </div>
                        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Centro de tareas de RRHH</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                            Lo que necesita atención hoy, ordenado por impacto y fecha. Resuelve cada asunto sin buscarlo por toda la aplicación.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 border-t border-slate-800 bg-slate-900/60 p-5 lg:w-72 lg:border-l lg:border-t-0">
                        <CompanyScopeSelect companies={companiesQuery.data || []} value={companyId} onChange={setCompanyId} hidden={!isGlobalAdmin} />
                        <button type="button" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending || (isGlobalAdmin && !companyId)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 text-sm font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-50">
                            <RefreshCw size={16} className={syncMutation.isPending ? 'animate-spin' : ''} />
                            Actualizar
                        </button>
                        <button type="button" onClick={() => setShowCreate(true)} disabled={isGlobalAdmin && !companyId} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 text-sm font-black text-white hover:bg-blue-400 disabled:opacity-50">
                            <Plus size={17} />
                            Nueva tarea
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-2 border-t border-slate-800 sm:grid-cols-5">
                    {[
                        { label: 'Pendientes', value: data?.summary.pending || 0, icon: ListTodo, tone: 'text-white' },
                        { label: 'Prioridad alta', value: data?.summary.urgent || 0, icon: AlertTriangle, tone: 'text-rose-300' },
                        { label: 'Vencidas', value: data?.summary.overdue || 0, icon: Clock3, tone: 'text-orange-300' },
                        { label: 'Esta semana', value: data?.summary.dueSoon || 0, icon: CalendarClock, tone: 'text-amber-300' },
                        { label: 'Resueltas este mes', value: data?.summary.completedThisMonth || 0, icon: CheckCircle2, tone: 'text-emerald-300' }
                    ].map((item) => (
                        <div key={item.label} className="border-b border-r border-slate-800 px-5 py-4 last:border-r-0 sm:border-b-0">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400"><item.icon size={14} />{item.label}</div>
                            <div className={`mt-1 text-2xl font-black ${item.tone}`}>{item.value}</div>
                        </div>
                    ))}
                </div>
            </section>

            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2 px-2 text-sm font-bold text-slate-500"><Filter size={16} /> Mostrar</div>
                <select value={priority} onChange={(event) => setPriority(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Filtrar por prioridad">
                    <option value="ALL">Todas las prioridades</option>
                    {Object.entries(PRIORITY).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}
                </select>
                <select value={category} onChange={(event) => setCategory(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950 dark:text-white" aria-label="Filtrar por área">
                    <option value="ALL">Todas las áreas</option>
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                {(priority !== 'ALL' || category !== 'ALL') && (
                    <button type="button" onClick={() => { setPriority('ALL'); setCategory('ALL'); }} className="min-h-11 rounded-xl px-3 text-sm font-bold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30">Limpiar filtros</button>
                )}
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
                <section className="min-h-[460px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-label="Tareas pendientes">
                    {overviewQuery.isLoading ? (
                        <div className="space-y-3 p-5 animate-pulse">
                            {[1, 2, 3, 4].map((item) => <div key={item} className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800" />)}
                        </div>
                    ) : groupedTasks.length === 0 ? (
                        <div className="flex min-h-[460px] flex-col items-center justify-center p-10 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"><CheckCircle2 size={30} /></div>
                            <h2 className="mt-5 text-xl font-black text-slate-900 dark:text-white">Todo al día</h2>
                            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">No hay tareas pendientes con estos filtros. Puedes crear una tarea manual o actualizar las comprobaciones automáticas.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {groupedTasks.map((group) => (
                                <div key={group.key}>
                                    <div className="sticky top-0 z-10 flex items-center justify-between bg-slate-50/95 px-5 py-3 backdrop-blur dark:bg-slate-950/90">
                                        <h2 className="text-xs font-black uppercase tracking-[0.17em] text-slate-500">{group.label}</h2>
                                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">{group.tasks.length}</span>
                                    </div>
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {group.tasks.map((task) => {
                                            const config = PRIORITY[task.priority] || PRIORITY.MEDIUM;
                                            const due = dueLabel(task.dueDate);
                                            const employee = taskEmployeeName(task);
                                            const isSelected = selectedTask?.id === task.id;
                                            return (
                                                <button
                                                    type="button"
                                                    key={task.id}
                                                    onClick={() => setSelectedTaskId(task.id)}
                                                    className={`group relative flex min-h-24 w-full gap-4 px-5 py-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${isSelected ? 'bg-blue-50/70 dark:bg-blue-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                                >
                                                    <span className={`mt-1 h-12 w-1 shrink-0 rounded-full ${config.dot}`} aria-hidden="true" />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="flex flex-wrap items-center gap-2">
                                                            <span className="font-black text-slate-900 dark:text-white">{task.title}</span>
                                                            {task.autoGenerated && <span title="Generada automáticamente"><Sparkles size={14} className="text-blue-500" /></span>}
                                                        </span>
                                                        {task.description && <span className="mt-1 block line-clamp-1 text-sm text-slate-500 dark:text-slate-400">{task.description}</span>}
                                                        <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
                                                            {employee && <span className="flex items-center gap-1.5"><UserRound size={13} />{employee}</span>}
                                                            <span className={due.overdue ? 'text-rose-600 dark:text-rose-400' : ''}><Clock3 size={13} className="mr-1 inline" />{due.text}</span>
                                                            <span>{CATEGORY_LABELS[task.category] || task.category}</span>
                                                        </span>
                                                    </span>
                                                    <ArrowRight size={18} className={`mt-2 shrink-0 transition-transform group-hover:translate-x-1 ${isSelected ? 'text-blue-600' : 'text-slate-300'}`} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:sticky xl:top-4 dark:border-slate-800 dark:bg-slate-900" aria-label="Detalle de la tarea">
                    {!selectedTask ? (
                        <div className="py-16 text-center text-sm text-slate-500">Selecciona una tarea para ver sus detalles.</div>
                    ) : (
                        <>
                            <div className="flex items-start justify-between gap-3">
                                <span className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${PRIORITY[selectedTask.priority]?.badge || PRIORITY.MEDIUM.badge}`}>
                                    {PRIORITY[selectedTask.priority]?.label || 'Media'}
                                </span>
                                {selectedTask.autoGenerated && <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400"><Sparkles size={13} />Automática</span>}
                            </div>
                            <h2 className="mt-5 text-2xl font-black leading-tight text-slate-950 dark:text-white">{selectedTask.title}</h2>
                            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{selectedTask.description || 'Sin información adicional.'}</p>
                            <dl className="mt-6 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50 px-4 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950/50">
                                <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-slate-500">Fecha límite</dt><dd className="font-bold text-slate-900 dark:text-white">{dueLabel(selectedTask.dueDate).text}</dd></div>
                                <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-slate-500">Área</dt><dd className="font-bold text-slate-900 dark:text-white">{CATEGORY_LABELS[selectedTask.category] || selectedTask.category}</dd></div>
                                {taskEmployeeName(selectedTask) && <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-slate-500">Trabajador</dt><dd className="text-right font-bold text-slate-900 dark:text-white">{taskEmployeeName(selectedTask)}</dd></div>}
                                <div className="flex justify-between gap-4 py-3 text-sm"><dt className="text-slate-500">Responsable</dt><dd className="text-right font-bold text-slate-900 dark:text-white">{selectedTask.assignedTo?.email || 'Sin asignar'}</dd></div>
                            </dl>
                            <div className="mt-6 grid gap-3">
                                {selectedTask.actionUrl && (
                                    <button type="button" onClick={() => navigate(selectedTask.actionUrl!)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-black text-white hover:bg-blue-700">
                                        Abrir y resolver <ArrowRight size={17} />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => updateMutation.mutate({ id: selectedTask.id, body: { status: 'COMPLETED' } })}
                                    disabled={updateMutation.isPending}
                                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 font-black text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                                >
                                    {updateMutation.isPending ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
                                    Marcar como resuelta
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateMutation.mutate({ id: selectedTask.id, body: { status: selectedTask.status === 'BLOCKED' ? 'PENDING' : 'BLOCKED' } })}
                                    className="min-h-11 rounded-xl px-4 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    {selectedTask.status === 'BLOCKED' ? 'Quitar bloqueo' : 'Marcar como bloqueada'}
                                </button>
                            </div>
                        </>
                    )}
                </aside>
            </div>

            {showCreate && (
                <TaskCreateDialog
                    companyId={companyId || user?.companyId}
                    onClose={() => setShowCreate(false)}
                    onCreated={() => queryClient.invalidateQueries({ queryKey: ['hr-task-overview'] })}
                />
            )}
        </div>
    );
}
