import { useCallback, useEffect, useState } from 'react';
import { Clock, Loader2, Lock, Save, Scale, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../../api/client';
import type { AuditLogEntry, PrivateNoteHistoryEntry } from '../types';
import { getEmployeeDisplayName } from '../../../utils/employeeDisplay';

type AccessResponse = {
    success?: boolean;
    data?: {
        email?: string;
    };
};

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
}

function extractAuditLogs(payload: unknown): AuditLogEntry[] {
    if (Array.isArray(payload)) {
        return payload as AuditLogEntry[];
    }

    if (payload && typeof payload === 'object' && 'data' in payload) {
        const data = (payload as { data?: unknown }).data;
        return Array.isArray(data) ? (data as AuditLogEntry[]) : [];
    }

    return [];
}

function extractPrivateNoteHistory(payload: unknown): PrivateNoteHistoryEntry[] {
    if (Array.isArray(payload)) {
        return payload as PrivateNoteHistoryEntry[];
    }

    if (payload && typeof payload === 'object' && 'data' in payload) {
        const data = (payload as { data?: unknown }).data;
        return Array.isArray(data) ? (data as PrivateNoteHistoryEntry[]) : [];
    }

    return [];
}

function SecuritySection({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
    const [loading, setLoading] = useState(false);

    const handleGenerateAccess = async () => {
        setLoading(true);
        try {
            const res = await api.post<AccessResponse>('/auth/generate-access', { employeeId });
            if (res.success) {
                toast.success(`Acceso generado. Credenciales enviadas a: ${res.data.email}`);
            }
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, 'Error al generar acceso'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-8 shadow-sm text-center">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck size={32} className="text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Acceso al Portal del Empleado</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md mx-auto">
                    Genera o restablece las credenciales de acceso para <strong>{employeeName}</strong>.
                    El sistema enviará automáticamente un correo electrónico con el DNI y una nueva contraseña.
                </p>
                <button
                    onClick={handleGenerateAccess}
                    disabled={loading}
                    className="w-full max-w-xs mx-auto py-3 bg-blue-600 text-white font-bold rounded-xl shadow-xl shadow-blue-500/20 hover:bg-blue-700 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <Lock size={20} />}
                    {loading ? 'Generando...' : 'Habilitar / Restablecer Acceso'}
                </button>
                <p className="text-xs text-slate-400 mt-4 font-medium uppercase tracking-wider">Se enviará un correo a la dirección personal</p>
            </div>
        </div>
    );
}

function PrivacySection({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(true);

    const fetchLogs = useCallback(async () => {
        try {
            setLogs(extractAuditLogs(await api.get(`/audit/EMPLOYEE/${employeeId}?showAccess=false`)));
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingLogs(false);
        }
    }, [employeeId]);

    useEffect(() => {
        void fetchLogs();
    }, [fetchLogs]);

    const downloadReport = async () => {
        try {
            const blob = await api.get<Blob>(`/employees/${employeeId}/portability-report`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `portabilidad_${employeeName.replace(/\s+/g, '_')}.json`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            toast.success('Reporte de portabilidad generado correctamente');
        } catch {
            toast.error('Error al descargar el reporte');
        }
    };

    return (
        <div className="space-y-8 max-w-4xl">
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h3 className="text-lg font-bold text-blue-900 dark:text-blue-400 flex items-center gap-2">
                        <Scale size={20} /> Derecho de Portabilidad (RGPD)
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-500 mt-1 max-w-xl">
                        Descarga un archivo JSON con todos los datos registrados del empleado.
                    </p>
                </div>
                <button onClick={downloadReport} className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 whitespace-nowrap">
                    Descargar Reporte JSON
                </button>
            </div>
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock size={20} className="text-slate-400" /> Historial de modificaciones de ficha
                </h3>
                <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 uppercase text-[10px] font-bold tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Acción</th>
                                <th className="px-6 py-4">Usuario</th>
                                <th className="px-6 py-4 text-right">Fecha</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loadingLogs ? (
                                <tr><td colSpan={3} className="p-8 text-center animate-pulse text-slate-400">Cargando registros...</td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan={3} className="p-8 text-center text-slate-400 italic">No hay modificaciones registradas para este empleado</td></tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${log.action === 'VIEW_SENSITIVE_DATA' ? 'bg-amber-100 text-amber-700 border-amber-200' : log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                                {log.action === 'VIEW_SENSITIVE_DATA' ? 'Consulta Datos' : log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium">
                                            {getEmployeeDisplayName(log.user, 'Sistema')}
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-500 tabular-nums font-medium">
                                            {new Date(log.createdAt).toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function RRHHNotesSection({ employeeId, value, onChange, onSave, saving }: { employeeId: string; value: string; onChange: (value: string) => void; onSave: () => Promise<void>; saving: boolean }) {
    const [history, setHistory] = useState<PrivateNoteHistoryEntry[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    const loadHistory = useCallback(async () => {
        try {
            setLoadingHistory(true);
            setHistory(extractPrivateNoteHistory(await api.get(`/employees/${employeeId}/private-notes/history`)));
        } catch (error) {
            console.error(error);
            toast.error('No se pudo cargar el historial de notas RRHH');
        } finally {
            setLoadingHistory(false);
        }
    }, [employeeId]);

    useEffect(() => {
        void loadHistory();
    }, [loadHistory]);

    const handleSave = async () => {
        try {
            await onSave();
            await loadHistory();
        } catch {
            // Error already handled by save action
        }
    };

    return (
        <div className="space-y-6">
            {/* Sticky Note Style - Windows Notes */}
            <div className="sticky-note">
                <div className="sticky-note-header">
                    <Save size={18} className="text-amber-700 dark:text-amber-300" />
                    <span className="sticky-note-title">Notas Privadas RRHH</span>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-400 mb-3 italic">
                    * Confidencial - Solo visible por RRHH
                </p>
                <textarea 
                    value={value} 
                    onChange={(event) => onChange(event.target.value)} 
                    placeholder="Escribe aquí tus notas..." 
                    className="sticky-note-textarea" 
                />
                <div className="sticky-note-footer">
                    <span>Última edición: {new Date().toLocaleDateString('es-ES')}</span>
                    <button 
                        onClick={handleSave} 
                        disabled={saving} 
                        className="px-3 py-1 bg-amber-600 text-white text-xs font-bold rounded hover:bg-amber-700 transition-all flex items-center gap-1 disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Guardar
                    </button>
                </div>
            </div>

            {/* Historial */}
            <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Clock size={18} className="text-slate-400" />
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">Historial</h4>
                </div>

                {loadingHistory ? (
                    <div className="py-8 text-sm text-slate-400 animate-pulse">Cargando historial...</div>
                ) : history.length === 0 ? (
                    <div className="py-8 text-sm text-slate-500 dark:text-slate-400 italic">Todavía no hay notas guardadas en el historial.</div>
                ) : (
                    <div className="space-y-4">
                        {history.map((entry, index) => (
                            <article key={entry.id} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                                        <span>{entry.authorName}</span>
                                        {index === 0 && (
                                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                                Ultima version
                                            </span>
                                        )}
                                        {entry.isLegacy && (
                                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                Sin auditoria previa
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                        {new Date(entry.createdAt).toLocaleString('es-ES')}
                                    </span>
                                </div>
                                <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">
                                    {entry.note || <span className="italic text-slate-400">Nota vaciada</span>}
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

interface EmployeeAdministrationSectionProps {
    activeTab: string;
    employeeId: string;
    employeeName: string;
    privateNotes: string;
    saving: boolean;
    onPrivateNotesChange: (value: string) => void;
    onPrivateNotesSave: () => Promise<void>;
}

export function EmployeeAdministrationSection(props: EmployeeAdministrationSectionProps) {
    if (props.activeTab === 'seguridad') {
        return <SecuritySection employeeId={props.employeeId} employeeName={props.employeeName} />;
    }
    if (props.activeTab === 'privacidad') {
        return <PrivacySection employeeId={props.employeeId} employeeName={props.employeeName} />;
    }
    if (props.activeTab === 'notas-rrhh') {
        return <RRHHNotesSection employeeId={props.employeeId} value={props.privateNotes} onChange={props.onPrivateNotesChange} onSave={props.onPrivateNotesSave} saving={props.saving} />;
    }
    return null;
}
