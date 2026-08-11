import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import {
    AlertTriangle,
    ArrowRight,
    BriefcaseBusiness,
    CheckCircle2,
    FileCheck2,
    FolderOpen,
    GraduationCap,
    PackageCheck,
    RefreshCw,
    ShieldCheck
} from 'lucide-react';
import { hrOperationsApi } from '../api';

function scoreTone(score: number) {
    if (score >= 85) return { color: '#059669', text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/30', label: 'Expediente preparado' };
    if (score >= 65) return { color: '#d97706', text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/30', label: 'Requiere completar' };
    return { color: '#e11d48', text: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-50 dark:bg-rose-950/30', label: 'Expediente incompleto' };
}

export function SmartEmployeeRecordPanel({ employeeId }: { employeeId: string }) {
    const query = useQuery({
        queryKey: ['smart-employee-record', employeeId],
        queryFn: () => hrOperationsApi.smartRecord(employeeId),
        staleTime: 60_000
    });
    if (query.isLoading) {
        return <div className="h-64 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800" />;
    }
    if (query.isError || !query.data) {
        return (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900 dark:bg-rose-950/20">
                <AlertTriangle className="text-rose-500" />
                <p className="mt-3 font-black text-rose-800 dark:text-rose-200">No se pudo analizar el expediente.</p>
                <button type="button" onClick={() => query.refetch()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold text-rose-700 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-950/50"><RefreshCw size={15} />Reintentar</button>
            </div>
        );
    }
    const record = query.data;
    const tone = scoreTone(record.score);
    return (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="grid lg:grid-cols-[320px_1fr]">
                <div className="border-b border-slate-100 bg-slate-950 p-6 text-white lg:border-b-0 lg:border-r lg:border-slate-800 sm:p-7">
                    <div className="flex items-center gap-2 text-blue-300">
                        <FolderOpen size={17} />
                        <p className="text-xs font-black uppercase tracking-[0.18em]">Expediente inteligente</p>
                    </div>
                    <div className="mt-6 flex items-center gap-5">
                        <div
                            className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
                            style={{ background: `conic-gradient(${tone.color} ${record.score * 3.6}deg, #334155 0deg)` }}
                            aria-label={`Expediente completado al ${record.score}%`}
                        >
                            <div className="flex h-[74px] w-[74px] flex-col items-center justify-center rounded-full bg-slate-950">
                                <span className="text-2xl font-black">{record.score}%</span>
                                <span className="text-[10px] font-bold uppercase text-slate-400">completo</span>
                            </div>
                        </div>
                        <div>
                            <p className={`text-sm font-black ${record.score >= 85 ? 'text-emerald-300' : record.score >= 65 ? 'text-amber-300' : 'text-rose-300'}`}>{tone.label}</p>
                            <p className="mt-1 text-sm leading-5 text-slate-400">{record.completed} de {record.total} requisitos cubiertos.</p>
                        </div>
                    </div>
                    <div className="mt-6 grid grid-cols-2 gap-2">
                        {[
                            { label: 'Documentos', value: record.counts.documents, icon: FileCheck2 },
                            { label: 'Formaciones', value: record.counts.trainings, icon: GraduationCap },
                            { label: 'Revisiones', value: record.counts.medicalReviews, icon: ShieldCheck },
                            { label: 'Activos', value: record.counts.assets, icon: PackageCheck }
                        ].map((item) => (
                            <div key={item.label} className="rounded-xl bg-slate-900 px-3 py-3 ring-1 ring-slate-800">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500"><item.icon size={12} />{item.label}</div>
                                <div className="mt-1 text-xl font-black">{item.value}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid md:grid-cols-2">
                    <div className="border-b border-slate-100 p-6 md:border-b-0 md:border-r dark:border-slate-800">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Requiere atención</p>
                                <h2 className="mt-1 text-lg font-black text-slate-950 dark:text-white">{record.attention.length ? `${record.attention.length} asuntos detectados` : 'Todo en orden'}</h2>
                            </div>
                            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${record.attention.length ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'}`}>
                                {record.attention.length ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
                            </div>
                        </div>
                        <div className="mt-4 space-y-2">
                            {record.attention.slice(0, 5).map((item) => (
                                <Link key={item.id} to={item.actionUrl} className="group flex min-h-14 items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 hover:border-blue-200 hover:bg-blue-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-800 dark:hover:border-blue-900 dark:hover:bg-blue-950/20">
                                    <span className={`h-8 w-1 shrink-0 rounded-full ${item.severity === 'HIGH' || item.severity === 'URGENT' ? 'bg-rose-500' : item.severity === 'MEDIUM' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-black text-slate-900 dark:text-white">{item.title}</span>
                                        <span className="block truncate text-xs text-slate-500">{item.description}</span>
                                    </span>
                                    <ArrowRight size={15} className="text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-blue-500" />
                                </Link>
                            ))}
                            {!record.attention.length && <p className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">No hay caducidades ni datos obligatorios pendientes.</p>}
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Seguimiento</p>
                                <h2 className="mt-1 text-lg font-black text-slate-950 dark:text-white">{record.tasks.length ? `${record.tasks.length} tareas abiertas` : 'Sin tareas abiertas'}</h2>
                            </div>
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"><BriefcaseBusiness size={20} /></div>
                        </div>
                        <div className="mt-4 space-y-2">
                            {record.tasks.slice(0, 5).map((task) => (
                                <Link key={task.id} to={task.actionUrl || `/hr/tasks?task=${task.id}`} className="group flex min-h-14 items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 hover:border-blue-200 hover:bg-blue-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-800 dark:hover:border-blue-900 dark:hover:bg-blue-950/20">
                                    <CheckCircle2 size={17} className="shrink-0 text-slate-300 group-hover:text-blue-500" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-black text-slate-900 dark:text-white">{task.title}</span>
                                        <span className="block text-xs font-semibold text-slate-500">{task.dueDate ? new Date(task.dueDate).toLocaleDateString('es-ES') : 'Sin fecha límite'} · {task.priority}</span>
                                    </span>
                                    <ArrowRight size={15} className="text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-blue-500" />
                                </Link>
                            ))}
                            {!record.tasks.length && <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500 dark:bg-slate-800/50">Las tareas relacionadas con este trabajador aparecerán aquí.</p>}
                        </div>
                        {record.missing.length > 0 && (
                            <p className={`mt-4 rounded-xl px-3 py-2.5 text-xs font-bold ${tone.bg} ${tone.text}`}>
                                Próximo paso recomendado: completar {record.missing[0].label.toLowerCase()}.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
