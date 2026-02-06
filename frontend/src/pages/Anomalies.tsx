import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';

type Anomaly = {
    id: string;
    entityType: string;
    entityId: string;
    employeeId?: string;
    score: number;
    reasons: { code: string; message: string; score: number }[];
    status: 'OPEN' | 'REVIEWED' | 'RESOLVED' | 'FALSE_POSITIVE';
    createdAt: string;
    employee?: { id: string; name?: string; firstName?: string; lastName?: string };
};

export default function AnomaliesPage() {
    const [rows, setRows] = useState<Anomaly[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('OPEN');
    const [typeFilter, setTypeFilter] = useState<string>('ALL');

    const load = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter !== 'ALL') params.append('status', statusFilter);
            if (typeFilter !== 'ALL') params.append('entityType', typeFilter);
            const res = await api.get(`/anomalies?${params.toString()}`);
            const payload = res.data?.data || res.data || res || {};
            const list = Array.isArray(payload) ? payload : (payload.data || []);
            setRows(list);
        } catch (e) {
            toast.error('Error cargando anomalías');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [statusFilter, typeFilter]);

    const updateStatus = async (id: string, status: Anomaly['status']) => {
        try {
            await api.put(`/anomalies/${id}/status`, { status });
            toast.success('Estado actualizado');
            load();
        } catch (e) {
            toast.error('No se pudo actualizar el estado');
        }
    };

    const statusBadge = (status: string) => {
        const styles: Record<string, string> = {
            OPEN: 'bg-amber-100 text-amber-700 border-amber-200',
            REVIEWED: 'bg-blue-100 text-blue-700 border-blue-200',
            RESOLVED: 'bg-green-100 text-green-700 border-green-200',
            FALSE_POSITIVE: 'bg-slate-200 text-slate-700 border-slate-300'
        };
        return (
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${styles[status] || ''}`}>
                {status}
            </span>
        );
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <AlertTriangle size={20} />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-900">Anomalías Detectadas</h1>
                    <p className="text-slate-500">Revisa y marca las incidencias detectadas automáticamente</p>
                </div>
            </div>

            <div className="flex flex-wrap gap-3">
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold"
                >
                    <option value="OPEN">OPEN</option>
                    <option value="REVIEWED">REVIEWED</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="FALSE_POSITIVE">FALSE_POSITIVE</option>
                    <option value="ALL">ALL</option>
                </select>

                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold"
                >
                    <option value="ALL">Todos</option>
                    <option value="TIME_ENTRY">Fichajes</option>
                    <option value="EXPENSE">Gastos</option>
                    <option value="VACATION">Ausencias</option>
                </select>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden">
                {loading ? (
                    <div className="p-10 text-slate-500 flex items-center gap-2">
                        <Clock size={16} /> Cargando anomalías...
                    </div>
                ) : rows.length === 0 ? (
                    <div className="p-10 text-slate-500">No hay anomalías con estos filtros.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 text-slate-400 text-[11px] font-black uppercase tracking-wider">
                                    <th className="px-6 py-4">Fecha</th>
                                    <th className="px-6 py-4">Tipo</th>
                                    <th className="px-6 py-4">Empleado</th>
                                    <th className="px-6 py-4">Score</th>
                                    <th className="px-6 py-4">Razones</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {rows.map((row) => (
                                    <tr key={row.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {new Date(row.createdAt).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-semibold">{row.entityType}</td>
                                        <td className="px-6 py-4 text-sm">
                                            {row.employee?.name || `${row.employee?.firstName || ''} ${row.employee?.lastName || ''}`.trim() || row.employeeId || '-'}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-sm font-bold">{row.score}</td>
                                        <td className="px-6 py-4 text-xs text-slate-600">
                                            {row.reasons?.map((r, idx) => (
                                                <div key={idx} className="mb-1">
                                                    {r.code}: {r.message}
                                                </div>
                                            ))}
                                        </td>
                                        <td className="px-6 py-4">{statusBadge(row.status)}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => updateStatus(row.id, 'RESOLVED')}
                                                    className="p-2 rounded-lg hover:bg-green-50 text-green-600"
                                                    title="Resolver"
                                                >
                                                    <CheckCircle2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => updateStatus(row.id, 'FALSE_POSITIVE')}
                                                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
                                                    title="Falso positivo"
                                                >
                                                    <XCircle size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
