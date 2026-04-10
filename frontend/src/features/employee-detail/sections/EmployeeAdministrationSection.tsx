import { useCallback, useEffect, useState } from 'react';
import { Clock, Loader2, Lock, Save, Scale, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../../api/client';
import type { AuditLogEntry } from '../types';

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
            setLogs(extractAuditLogs(await api.get(`/audit/EMPLOYEE/${employeeId}`)));
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
                    <Clock size={20} className="text-slate-400" /> Historial de Acceso y Modificaciones
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
                                <tr><td colSpan={3} className="p-8 text-center text-slate-400 italic">No hay registros de actividad para este empleado</td></tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${log.action === 'VIEW_SENSITIVE_DATA' ? 'bg-amber-100 text-amber-700 border-amber-200' : log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                                {log.action === 'VIEW_SENSITIVE_DATA' ? 'Consulta Datos' : log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium">
                                            {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Sistema'}
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

function RRHHNotesSection({ value, onChange, onSave, saving }: { value: string; onChange: (value: string) => void; onSave: () => void; saving: boolean }) {
    return (
        <div className="space-y-6">
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-amber-900 dark:text-amber-400 flex items-center gap-2 mb-4">
                    <Save size={20} className="text-amber-600" /> Notas Administrativas Privadas
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-500 mb-4 italic">
                    * Estas notas son estrictamente confidenciales y solo visibles por RRHH / Administración.
                </p>
                <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder="Escribe aquí notas sobre el empleado" className="w-full h-64 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-amber-500 outline-none text-slate-700 dark:text-slate-200" />
                <div className="flex justify-end mt-4">
                    <button onClick={onSave} disabled={saving} className="px-6 py-2 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition-all flex items-center gap-2 disabled:opacity-50">
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Guardar Nota
                    </button>
                </div>
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
    onPrivateNotesSave: () => void;
}

export function EmployeeAdministrationSection(props: EmployeeAdministrationSectionProps) {
    if (props.activeTab === 'seguridad') {
        return <SecuritySection employeeId={props.employeeId} employeeName={props.employeeName} />;
    }
    if (props.activeTab === 'privacidad') {
        return <PrivacySection employeeId={props.employeeId} employeeName={props.employeeName} />;
    }
    if (props.activeTab === 'notas-rrhh') {
        return <RRHHNotesSection value={props.privateNotes} onChange={props.onPrivateNotesChange} onSave={props.onPrivateNotesSave} saving={props.saving} />;
    }
    return null;
}
