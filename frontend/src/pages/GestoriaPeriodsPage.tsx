/**
 * GestoriaPeriodsPage — punto de entrada del módulo.
 *
 * Permite seleccionar empresa (si el usuario tiene varias), año y mes
 * y crear/abrir el periodo correspondiente. Muestra también la lista
 * de periodos existentes con su estado (abierto/cerrado) y enlaces
 * rápidos al "Control general" y a la "Exportación".
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
    ArrowRight,
    Calendar as CalendarIcon,
    FileSpreadsheet,
    Lock,
    Plus,
    Settings,
    Unlock
} from 'lucide-react';
import { toast } from 'sonner';

import { gestoriaApi, type GestoriaPeriod, type GestoriaPeriodStatus } from '../api/gestoria';
import { useAuth } from '../contexts/AuthContext';
import { ApiError, getErrorMessage } from '../api/client';
import Modal from '../components/ui/Modal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Link } from 'react-router';

const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function GestoriaPeriodsPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();

    const companyId = searchParams.get('companyId') || user?.companyId;

    const [periods, setPeriods] = useState<GestoriaPeriod[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [newYear, setNewYear] = useState(new Date().getFullYear());
    const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1);
    const [creating, setCreating] = useState(false);

    const load = async () => {
        if (!companyId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await gestoriaApi.listPeriods(companyId);
            setPeriods(res.data || []);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [companyId]);

    const handleCreate = async () => {
        setCreating(true);
        try {
            const res = await gestoriaApi.createPeriod(companyId, { year: newYear, month: newMonth });
            toast.success('Periodo creado');
            setShowCreate(false);
            navigate(`/gestoria/control/${res.data.id}`);
        } catch (e) {
            toast.error(getErrorMessage(e, 'Error al crear el periodo'));
        } finally {
            setCreating(false);
        }
    };

    const handleReopen = async (id: string) => {
        const reason = window.prompt('Motivo de la reapertura (mín. 5 caracteres):');
        if (!reason || reason.trim().length < 5) {
            toast.error('Motivo obligatorio (mín. 5 caracteres)');
            return;
        }
        try {
            await gestoriaApi.reopenPeriod(id, reason.trim());
            toast.success('Periodo reabierto');
            load();
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Error';
            toast.error(msg);
        }
    };

    return (
        <div className="space-y-6">
            <nav className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                <Link to="/gestoria" className="hover:text-indigo-600">Gestoría</Link>
            </nav>
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Preparación para gestoría
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Captura manual de horas, precios e importes para enviar a la gestoría. Reemplaza
                        la plantilla individual, el control general y la plantilla .xls de la gestoría.
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    disabled={!companyId}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                >
                    <Plus size={18} /> Nuevo periodo
                </button>
            </header>

            {!companyId && (
                <EmptyState
                    title="Selecciona una empresa"
                    description="No se ha detectado una empresa activa. Configura tu empresa para empezar a usar el módulo de gestoría."
                />
            )}

            {loading && <LoadingSpinner label="Cargando periodos..." />}
            {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                </div>
            )}

            {!loading && periods.length === 0 && companyId && (
                <EmptyState
                    title="Sin periodos"
                    description="Aún no has creado ningún periodo. Crea uno con el botón superior derecho para empezar a capturar datos."
                />
            )}

            {!loading && periods.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/50">
                            <tr>
                                <th className="px-6 py-3">Periodo</th>
                                <th className="px-6 py-3">Estado</th>
                                <th className="px-6 py-3">Filas / Conceptos</th>
                                <th className="px-6 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {periods.map((p) => (
                                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                        {MONTHS[p.month - 1]} {p.year}
                                    </td>
                                    <td className="px-6 py-4">
                                        {p.status === 'OPEN' ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                                <Unlock size={12} /> Abierto
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                                                <Lock size={12} /> Cerrado
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                        {p._count?.rows ?? 0} filas · {p._count?.concepts ?? 0} conceptos
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => navigate(`/gestoria/control/${p.id}`)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                                            >
                                                <FileSpreadsheet size={14} /> Control
                                            </button>
                                            <button
                                                onClick={() => navigate(`/gestoria/export/${p.id}`)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                                            >
                                                <ArrowRight size={14} /> Exportar
                                            </button>
                                            <button
                                                onClick={() => navigate(`/gestoria/concepts/${p.id}`)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                                            >
                                                <Settings size={14} /> Conceptos
                                            </button>
                                            {p.status === 'CLOSED' && (
                                                <button
                                                    onClick={() => handleReopen(p.id)}
                                                    className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                                                >
                                                    <Unlock size={14} /> Reabrir
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Nuevo periodo de gestoría">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Año</label>
                        <input
                            type="number"
                            min={2000}
                            max={2100}
                            value={newYear}
                            onChange={(e) => setNewYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Mes</label>
                        <select
                            value={newMonth}
                            onChange={(e) => setNewMonth(parseInt(e.target.value, 10))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                        >
                            {MONTHS.map((m, idx) => (
                                <option key={idx + 1} value={idx + 1}>{m}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            onClick={() => setShowCreate(false)}
                            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={creating}
                            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                        >
                            {creating ? <LoadingSpinner size="sm" /> : <CalendarIcon size={16} />}
                            Crear
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
