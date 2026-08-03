import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import {
    BellRing,
    CalendarClock,
    Check,
    CircleAlert,
    CircleCheck,
    Clock3,
    Loader2,
    Mail,
    Settings,
    ShieldCheck,
    SlidersHorizontal,
    UserRoundCheck,
    Users
} from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { hrOperationsApi } from '../features/hr-operations/api';
import { CompanyScopeSelect } from '../features/hr-operations/components/CompanyScopeSelect';
import type { HrAlertRule } from '../features/hr-operations/types';

const SEVERITIES = [
    { value: 'LOW', label: 'Normal' },
    { value: 'MEDIUM', label: 'Media' },
    { value: 'HIGH', label: 'Alta' },
    { value: 'URGENT', label: 'Urgente' }
];

function parseStringArray(value: string, fallback: string[] = []): string[] {
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String) : fallback;
    } catch {
        return fallback;
    }
}

function splitEmails(value: string) {
    return [...new Set(value.split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

export function RuleCard({
    rule,
    onSave,
    saving
}: {
    rule: HrAlertRule;
    onSave: (body: Record<string, unknown>) => void;
    saving: boolean;
}) {
    const initialDraft = () => ({
        enabled: rule.enabled,
        leadDays: rule.leadDays,
        severity: rule.severity,
        channels: parseStringArray(rule.channels, ['IN_APP']),
        emailMode: rule.emailMode || 'IMMEDIATE',
        emailRecipientsText: parseStringArray(rule.emailRecipients).join(', '),
        emailIncludeHr: rule.emailIncludeHr,
        emailIncludeManager: rule.emailIncludeManager
    });
    const [draft, setDraft] = useState(initialDraft);
    useEffect(() => setDraft(initialDraft()), [rule]);

    const emailEnabled = draft.channels.includes('EMAIL');
    const parsedRecipients = splitEmails(draft.emailRecipientsText);
    const hasEmailRecipient = draft.emailIncludeHr || draft.emailIncludeManager || parsedRecipients.length > 0;
    const changed =
        draft.enabled !== rule.enabled ||
        draft.leadDays !== rule.leadDays ||
        draft.severity !== rule.severity ||
        JSON.stringify(draft.channels) !== JSON.stringify(parseStringArray(rule.channels, ['IN_APP'])) ||
        draft.emailMode !== rule.emailMode ||
        draft.emailIncludeHr !== rule.emailIncludeHr ||
        draft.emailIncludeManager !== rule.emailIncludeManager ||
        JSON.stringify(parsedRecipients) !== JSON.stringify(parseStringArray(rule.emailRecipients));

    const toggleEmail = () => {
        setDraft((current) => ({
            ...current,
            channels: current.channels.includes('EMAIL')
                ? current.channels.filter((channel) => channel !== 'EMAIL')
                : [...current.channels.filter((channel) => channel !== 'EMAIL'), 'EMAIL']
        }));
    };

    return (
        <article className={`rounded-3xl border bg-white p-5 shadow-sm transition-colors dark:bg-slate-900 ${draft.enabled ? 'border-slate-200 dark:border-slate-800' : 'border-slate-200 opacity-70 dark:border-slate-800'}`}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${draft.enabled ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                        <BellRing size={20} />
                    </div>
                    <div>
                        <h2 className="font-black text-slate-950 dark:text-white">{rule.name}</h2>
                        <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{rule.description}</p>
                    </div>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={draft.enabled}
                    onClick={() => setDraft((current) => ({ ...current, enabled: !current.enabled }))}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${draft.enabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                    aria-label={`${draft.enabled ? 'Desactivar' : 'Activar'} ${rule.name}`}
                >
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${draft.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            <fieldset disabled={!draft.enabled} className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 dark:border-slate-800">
                <label>
                    <span className="mb-1.5 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500"><CalendarClock size={14} />Antelación</span>
                    <div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-950">
                        <input
                            type="number"
                            min={0}
                            max={365}
                            value={draft.leadDays}
                            onChange={(event) => setDraft((current) => ({ ...current, leadDays: Number(event.target.value) }))}
                            className="w-full bg-transparent text-base font-bold text-slate-900 outline-none dark:text-white"
                        />
                        <span className="text-sm font-semibold text-slate-500">días antes</span>
                    </div>
                </label>
                <label>
                    <span className="mb-1.5 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500"><SlidersHorizontal size={14} />Prioridad</span>
                    <select value={draft.severity} onChange={(event) => setDraft((current) => ({ ...current, severity: event.target.value as HrAlertRule['severity'] }))} className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                        {SEVERITIES.map((severity) => <option key={severity.value} value={severity.value}>{severity.label}</option>)}
                    </select>
                </label>
            </fieldset>

            <fieldset disabled={!draft.enabled} className="mt-4">
                <legend className="text-xs font-black uppercase tracking-wider text-slate-500">Dónde avisar</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="flex min-h-12 items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-3 text-sm font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                        <BellRing size={16} />
                        Aplicación
                        <Check size={14} className="ml-auto" />
                    </div>
                    <button
                        type="button"
                        onClick={toggleEmail}
                        aria-pressed={emailEnabled}
                        className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${emailEnabled ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300' : 'border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50/50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-blue-950/20'}`}
                    >
                        <Mail size={16} />
                        Correo electrónico
                        {emailEnabled && <Check size={14} className="ml-auto" />}
                    </button>
                </div>
            </fieldset>

            {emailEnabled && (
                <fieldset disabled={!draft.enabled} className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/40 p-4 dark:border-blue-900/60 dark:bg-blue-950/15">
                    <legend className="px-1 text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">Entrega por correo</legend>
                    <label className="mt-1 block">
                        <span className="mb-1.5 flex items-center gap-2 text-xs font-black text-slate-600 dark:text-slate-300"><Clock3 size={14} />Frecuencia</span>
                        <select
                            aria-label="Frecuencia del correo"
                            value={draft.emailMode}
                            onChange={(event) => setDraft((current) => ({ ...current, emailMode: event.target.value as HrAlertRule['emailMode'] }))}
                            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        >
                            <option value="IMMEDIATE">Inmediato, al detectar el aviso</option>
                            <option value="DAILY_DIGEST">Resumen diario, un solo correo</option>
                        </select>
                    </label>

                    <div className="mt-4 space-y-2">
                        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950">
                            <input
                                type="checkbox"
                                checked={draft.emailIncludeHr}
                                onChange={(event) => setDraft((current) => ({ ...current, emailIncludeHr: event.target.checked }))}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <Users size={16} className="text-blue-600" />
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Equipo de RRHH de la empresa</span>
                        </label>
                        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950">
                            <input
                                type="checkbox"
                                checked={draft.emailIncludeManager}
                                onChange={(event) => setDraft((current) => ({ ...current, emailIncludeManager: event.target.checked }))}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <UserRoundCheck size={16} className="text-blue-600" />
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Responsable del trabajador</span>
                        </label>
                    </div>

                    <label className="mt-4 block">
                        <span className="mb-1.5 block text-xs font-black text-slate-600 dark:text-slate-300">Otros destinatarios</span>
                        <textarea
                            aria-label="Otros destinatarios"
                            rows={2}
                            value={draft.emailRecipientsText}
                            onChange={(event) => setDraft((current) => ({ ...current, emailRecipientsText: event.target.value }))}
                            placeholder="rrhh@empresa.es, direccion@empresa.es"
                            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                        <span className="mt-1 block text-xs text-slate-500">Separa varias direcciones con comas.</span>
                    </label>

                    {!hasEmailRecipient && (
                        <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                            <CircleAlert size={15} />Selecciona al menos un destinatario.
                        </p>
                    )}
                </fieldset>
            )}

            <div className="mt-5 flex justify-end">
                <button
                    type="button"
                    disabled={!changed || saving || (emailEnabled && !hasEmailRecipient)}
                    onClick={() => onSave({
                        enabled: draft.enabled,
                        leadDays: draft.leadDays,
                        severity: draft.severity,
                        channels: draft.channels,
                        emailMode: draft.emailMode,
                        emailRecipients: parsedRecipients,
                        emailIncludeHr: draft.emailIncludeHr,
                        emailIncludeManager: draft.emailIncludeManager
                    })}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Guardar regla
                </button>
            </div>
        </article>
    );
}

export default function HrAlertSettingsPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const isGlobalAdmin = user?.role === 'admin' && !user.companyId;
    const [companyId, setCompanyId] = useState(user?.companyId || '');
    const [savingId, setSavingId] = useState<string | null>(null);
    const companiesQuery = useQuery({
        queryKey: ['companies', 'hr-alerts'],
        queryFn: hrOperationsApi.companies,
        enabled: isGlobalAdmin
    });
    useEffect(() => {
        if (isGlobalAdmin && !companyId && companiesQuery.data?.[0]) setCompanyId(companiesQuery.data[0].id);
    }, [companiesQuery.data, companyId, isGlobalAdmin]);
    const canLoad = Boolean(companyId || !isGlobalAdmin);
    const rulesQuery = useQuery({
        queryKey: ['hr-alert-rules', companyId],
        queryFn: () => hrOperationsApi.alertRules(companyId || undefined),
        enabled: canLoad
    });
    const emailStatusQuery = useQuery({
        queryKey: ['hr-alert-email-status', companyId],
        queryFn: () => hrOperationsApi.alertEmailStatus(companyId || undefined),
        enabled: canLoad,
        refetchInterval: 60_000
    });
    const mutation = useMutation({
        mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => hrOperationsApi.updateAlertRule(id, body),
        onMutate: ({ id }) => setSavingId(id),
        onSuccess: () => {
            toast.success('Regla guardada');
            queryClient.invalidateQueries({ queryKey: ['hr-alert-rules'] });
            queryClient.invalidateQueries({ queryKey: ['hr-alert-email-status'] });
        },
        onError: (error) => toast.error(getErrorMessage(error, 'No se pudo guardar la regla')),
        onSettled: () => setSavingId(null)
    });
    const emailStatus = emailStatusQuery.data;

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:flex-row lg:items-end lg:justify-between dark:border-slate-800 dark:bg-slate-900">
                <div>
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                        <ShieldCheck size={18} />
                        <p className="text-xs font-black uppercase tracking-[0.2em]">Prevención</p>
                    </div>
                    <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Alertas configurables</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Decide qué debe vigilar la aplicación, con cuánta antelación y si debe avisar también por correo.
                    </p>
                </div>
                <CompanyScopeSelect companies={companiesQuery.data || []} value={companyId} onChange={setCompanyId} hidden={!isGlobalAdmin} />
            </header>

            {emailStatus && (
                <section className={`flex flex-col gap-4 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${emailStatus.configured ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20'}`}>
                    <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${emailStatus.configured ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'}`}>
                            {emailStatus.configured ? <CircleCheck size={20} /> : <CircleAlert size={20} />}
                        </div>
                        <div>
                            <h2 className="font-black text-slate-950 dark:text-white">{emailStatus.configured ? 'Correo preparado para enviar' : 'Falta configurar el correo'}</h2>
                            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                                {emailStatus.configured
                                    ? `${emailStatus.sent} enviados y ${emailStatus.failed} fallidos durante los últimos 30 días.`
                                    : 'Puedes preparar las reglas ahora; los envíos comenzarán al configurar SMTP.'}
                            </p>
                        </div>
                    </div>
                    <Link to="/settings" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-current px-4 text-sm font-black text-slate-700 hover:bg-white/60 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200 dark:hover:bg-slate-900/40">
                        <Settings size={16} />Configurar SMTP
                    </Link>
                </section>
            )}

            <div className="grid items-start gap-4 lg:grid-cols-2">
                {rulesQuery.isLoading
                    ? [1, 2, 3, 4].map((item) => <div key={item} className="h-96 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />)
                    : (rulesQuery.data || []).map((rule) => (
                        <RuleCard
                            key={rule.id}
                            rule={rule}
                            saving={savingId === rule.id}
                            onSave={(body) => mutation.mutate({ id: rule.id, body })}
                        />
                    ))}
            </div>
            {!rulesQuery.isLoading && (rulesQuery.data || []).length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-500 dark:border-slate-700">
                    Selecciona una empresa para configurar sus alertas.
                </div>
            )}
        </div>
    );
}
