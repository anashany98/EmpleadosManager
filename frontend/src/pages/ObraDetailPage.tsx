import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Briefcase, Calendar, DollarSign, Plus, Trash2, Pencil, Save, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../api/client';
import { useConfirm } from '../context/ConfirmContext';
import { OBRA_TYPE_LABELS, OBRA_EXPENSE_TYPES, type ObraExpenseType } from '@shared/obras';

void OBRA_TYPE_LABELS;

const TIPOS: ObraExpenseType[] = [...OBRA_EXPENSE_TYPES];

const TIPO_LABELS: Record<ObraExpenseType, string> = {
    PER_DIEM: 'Dieta',
    LODGING: 'Hospedaje',
    FLIGHT: 'Vuelo',
    TRANSPORT: 'Transporte',
    OTHER: 'Otro'
};

const TIPO_COLORS: Record<ObraExpenseType, string> = {
    PER_DIEM: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    LODGING: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    FLIGHT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    TRANSPORT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    OTHER: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
};

type Tab = 'info' | 'hours' | 'expenses';

interface ObraShape {
    id: string;
    code: string;
    name: string;
    clientName?: string | null;
    destination?: string | null;
    description?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    budget?: string | number | null;
    managerId?: string | null;
    manager?: { id: string; name?: string | null } | null;
    status: 'ACTIVE' | 'INACTIVE';
    active: boolean;
    createdAt: string;
    updatedAt: string;
    expenses?: any[];
    employeeWork?: any[];
    totals?: { hours: number; byType: Record<string, number>; totalExpenses: number };
}

export default function ObraDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const confirmAction = useConfirm();
    const [obra, setObra] = useState<ObraShape | null>(null);
    const [employees, setEmployees] = useState<any[]>([]);
    const [tab, setTab] = useState<Tab>('info');
    const [loading, setLoading] = useState(false);
    const [hoursForm, setHoursForm] = useState({ employeeId: '', startDate: '', endDate: '', hours: 8, notes: '' });
    const [hoursEditingId, setHoursEditingId] = useState<string | null>(null);
    const [expenseForm, setExpenseForm] = useState({ type: 'PER_DIEM' as ObraExpenseType, date: '', amount: '', currency: 'EUR', employeeId: '', description: '', vendor: '', reference: '', origin: '', destination: '' });
    const [expenseEditingId, setExpenseEditingId] = useState<string | null>(null);

    const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;

    const fetchObra = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/obras/${id}`);
            setObra(unwrap(res) as ObraShape);
        } catch (err: any) {
            toast.error(getErrorMessage(err, 'Error al cargar la obra'));
            navigate('/obras');
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const res = await api.get('/employees', { params: { limit: 200 } });
            setEmployees(unwrap(res) || []);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => { if (id) fetchObra(); }, [id]);
    useEffect(() => { fetchEmployees(); }, []);

    if (loading || !obra) {
        return (
            <div className="flex items-center justify-center h-48">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    const closed = obra.status === 'INACTIVE';
    const totalsByType: Record<string, number> = obra.totals?.byType || {};
    const totalExpenses = Number(obra.totals?.totalExpenses || 0);
    const totalHours = Number(obra.totals?.hours || 0);

    const handleSaveExpense = async () => {
        if (!expenseForm.date || !expenseForm.amount) return toast.error('Fecha e importe son obligatorios');
        const amountNum = Number(expenseForm.amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) return toast.error('Importe debe ser > 0');
        try {
            const payload: any = {
                type: expenseForm.type,
                date: expenseForm.date,
                amount: amountNum,
                currency: expenseForm.currency || 'EUR',
                employeeId: expenseForm.employeeId || null,
                description: expenseForm.description || null,
                vendor: expenseForm.vendor || null,
                reference: expenseForm.reference || null,
                origin: expenseForm.origin || null,
                destination: expenseForm.destination || null
            };
            if (expenseEditingId) {
                await api.patch(`/obra-expenses/${expenseEditingId}`, payload);
                toast.success('Gasto actualizado');
            } else {
                await api.post(`/obras/${id}/expenses`, payload);
                toast.success('Gasto creado');
            }
            setExpenseForm({ type: 'PER_DIEM', date: '', amount: '', currency: 'EUR', employeeId: '', description: '', vendor: '', reference: '', origin: '', destination: '' });
            setExpenseEditingId(null);
            fetchObra();
        } catch (err: any) {
            toast.error(getErrorMessage(err, 'Error al guardar gasto'));
        }
    };

    const handleDeleteExpense = async (eid: string) => {
        const ok = await confirmAction({ title: 'Eliminar gasto', message: '¿Eliminar este gasto?', confirmText: 'Eliminar', type: 'danger' });
        if (!ok) return;
        try {
            await api.delete(`/obra-expenses/${eid}`);
            toast.success('Eliminado');
            fetchObra();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Error al eliminar'));
        }
    };

    const handleSaveHours = async () => {
        if (!hoursForm.employeeId || !hoursForm.startDate || !hoursForm.endDate) {
            return toast.error('Empleado y fechas son obligatorios');
        }
        if (hoursForm.startDate > hoursForm.endDate) {
            return toast.error('Fecha fin debe ser posterior o igual a fecha inicio');
        }
        try {
            const payload: any = {
                employeeId: hoursForm.employeeId,
                projectId: id,
                startDate: hoursForm.startDate,
                endDate: hoursForm.endDate,
                hours: Number(hoursForm.hours),
                notes: hoursForm.notes || null
            };
            if (hoursEditingId) {
                await api.patch(`/employee-project-work/${hoursEditingId}`, payload);
                toast.success('Horas actualizadas');
            } else {
                await api.post('/employee-project-work', payload);
                toast.success('Horas registradas');
            }
            setHoursForm({ employeeId: '', startDate: '', endDate: '', hours: 8, notes: '' });
            setHoursEditingId(null);
            fetchObra();
        } catch (err: any) {
            toast.error(getErrorMessage(err, 'Error al guardar horas'));
        }
    };

    const handleDeleteHours = async (hid: string) => {
        const ok = await confirmAction({ title: 'Eliminar horas', message: '¿Eliminar este registro?', confirmText: 'Eliminar', type: 'danger' });
        if (!ok) return;
        try {
            await api.delete(`/employee-project-work/${hid}`);
            toast.success('Eliminado');
            fetchObra();
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'Error al eliminar'));
        }
    };

    const tabs: { id: Tab; label: string; icon: any }[] = [
        { id: 'info', label: 'Información', icon: Briefcase },
        { id: 'hours', label: `Horas (${obra.employeeWork?.length || 0})`, icon: Calendar },
        { id: 'expenses', label: `Gastos (${obra.expenses?.length || 0})`, icon: DollarSign }
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/obras')} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200" aria-label="Volver al listado">
                    <ArrowLeft size={22} />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">{obra.code}</span>
                        {closed && <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700">Cerrada</span>}
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{obra.name}</h1>
                    </div>
                    {obra.clientName && <p className="text-slate-500 text-sm">Cliente: {obra.clientName}</p>}
                </div>
                <button onClick={() => navigate('/obras/imports')} className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm flex items-center gap-1.5 hover:bg-slate-200">
                    <Upload size={16} /> Importar gastos
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {TIPOS.map((t) => (
                    <div key={t} className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
                        <p className="text-xs text-slate-500">{TIPO_LABELS[t]}</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{Number(totalsByType[t] || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
                    </div>
                ))}
            </div>

            <div className="border-b border-slate-200 dark:border-slate-800 flex gap-1">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`px-4 py-2.5 text-sm font-medium flex items-center gap-1.5 border-b-2 transition-colors ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <t.icon size={16} /> {t.label}
                    </button>
                ))}
            </div>

            {tab === 'info' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                        <h3 className="font-bold text-slate-900 dark:text-white mb-3">Datos generales</h3>
                        <dl className="space-y-2 text-sm">
                            <div className="flex justify-between"><dt className="text-slate-500">Cliente</dt><dd>{obra.clientName || '—'}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500">Destino</dt><dd>{obra.destination || '—'}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500">Inicio</dt><dd>{obra.startDate ? String(obra.startDate).substring(0, 10) : '—'}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500">Fin</dt><dd>{obra.endDate ? String(obra.endDate).substring(0, 10) : '—'}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500">Presupuesto</dt><dd>{obra.budget ? Number(obra.budget).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : '—'}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500">Responsable</dt><dd>{obra.manager?.name || '—'}</dd></div>
                        </dl>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                        <h3 className="font-bold text-slate-900 dark:text-white mb-3">Resumen</h3>
                        <dl className="space-y-2 text-sm">
                            <div className="flex justify-between"><dt className="text-slate-500">Total horas imputadas</dt><dd className="font-semibold">{totalHours.toFixed(2)} h</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500">Total gastos</dt><dd className="font-semibold">{totalExpenses.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500">Nº gastos</dt><dd>{obra.expenses?.length || 0}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500">Nº registros de horas</dt><dd>{obra.employeeWork?.length || 0}</dd></div>
                            {obra.budget && (
                                <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-2">
                                    <dt className="text-slate-500">% presupuesto consumido</dt>
                                    <dd className={`font-semibold ${totalExpenses > Number(obra.budget) ? 'text-rose-600' : 'text-blue-600'}`}>
                                        {((totalExpenses / Number(obra.budget)) * 100).toFixed(1)}%
                                    </dd>
                                </div>
                            )}
                        </dl>
                    </div>
                    {obra.description && (
                        <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                            <h3 className="font-bold text-slate-900 dark:text-white mb-2">Descripción</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{obra.description}</p>
                        </div>
                    )}
                </div>
            )}

            {tab === 'hours' && (
                <div className="space-y-4">
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                        <h3 className="font-bold mb-3 flex items-center gap-1.5"><Plus size={16} /> {hoursEditingId ? 'Editar horas' : 'Añadir horas'}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                            <select className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" value={hoursForm.employeeId} onChange={(e) => setHoursForm({ ...hoursForm, employeeId: e.target.value })}>
                                <option value="">Empleado...</option>
                                {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name || `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.dni}</option>)}
                            </select>
                            <input type="date" className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" value={hoursForm.startDate} onChange={(e) => setHoursForm({ ...hoursForm, startDate: e.target.value })} />
                            <input type="date" className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" value={hoursForm.endDate} onChange={(e) => setHoursForm({ ...hoursForm, endDate: e.target.value })} />
                            <input type="number" step="0.25" min="0" className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" value={hoursForm.hours} onChange={(e) => setHoursForm({ ...hoursForm, hours: Number(e.target.value) })} placeholder="Horas" />
                            <button onClick={handleSaveHours} className="px-3 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-1 justify-center"><Save size={14} /> Guardar</button>
                        </div>
                        <input className="w-full mt-2 px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" placeholder="Notas..." value={hoursForm.notes} onChange={(e) => setHoursForm({ ...hoursForm, notes: e.target.value })} />
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase text-slate-500">
                                <tr>
                                    <th className="px-4 py-3 text-left">Empleado</th>
                                    <th className="px-4 py-3 text-left">Desde</th>
                                    <th className="px-4 py-3 text-left">Hasta</th>
                                    <th className="px-4 py-3 text-right">Horas</th>
                                    <th className="px-4 py-3 text-left">Notas</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {(obra.employeeWork || []).map((w: any) => (
                                    <tr key={w.id}>
                                        <td className="px-4 py-3">{w.employee?.name || `${w.employee?.firstName || ''} ${w.employee?.lastName || ''}`.trim() || '—'}</td>
                                        <td className="px-4 py-3">{String(w.startDate).substring(0, 10)}</td>
                                        <td className="px-4 py-3">{String(w.endDate).substring(0, 10)}</td>
                                        <td className="px-4 py-3 text-right font-semibold">{Number(w.hours).toFixed(2)} h</td>
                                        <td className="px-4 py-3 text-slate-500 text-xs">{w.notes || '—'}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => { setHoursForm({ employeeId: w.employeeId, startDate: String(w.startDate).substring(0, 10), endDate: String(w.endDate).substring(0, 10), hours: w.hours, notes: w.notes || '' }); setHoursEditingId(w.id); }} className="text-blue-600 mr-2" aria-label="Editar"><Pencil size={14} /></button>
                                            <button onClick={() => handleDeleteHours(w.id)} className="text-rose-600" aria-label="Eliminar"><Trash2 size={14} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {(!obra.employeeWork || obra.employeeWork.length === 0) && (
                                    <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Sin registros.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {tab === 'expenses' && (
                <div className="space-y-4">
                    {closed && (
                        <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 text-amber-800 dark:text-amber-200 rounded-lg px-4 py-3 text-sm">
                            ⚠ Esta obra está cerrada. No se pueden añadir nuevos gastos; las correcciones siguen permitidas.
                        </div>
                    )}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                        <h3 className="font-bold mb-3 flex items-center gap-1.5"><Plus size={16} /> {expenseEditingId ? 'Editar gasto' : 'Añadir gasto manual'}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <select className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" value={expenseForm.type} onChange={(e) => setExpenseForm({ ...expenseForm, type: e.target.value as ObraExpenseType })}>
                                {TIPOS.map((t) => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                            </select>
                            <input type="date" className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} />
                            <input type="number" step="0.01" min="0" className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} placeholder="Importe (€)" />
                            <select className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" value={expenseForm.employeeId} onChange={(e) => setExpenseForm({ ...expenseForm, employeeId: e.target.value })}>
                                <option value="">Empleado (opcional)...</option>
                                {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name || `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.dni}</option>)}
                            </select>
                            <input className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 md:col-span-2" placeholder="Descripción..." value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} />
                            <input className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" placeholder="Proveedor" value={expenseForm.vendor} onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })} />
                            <input className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" placeholder="Referencia" value={expenseForm.reference} onChange={(e) => setExpenseForm({ ...expenseForm, reference: e.target.value })} />
                            {(expenseForm.type === 'FLIGHT' || expenseForm.type === 'TRANSPORT') && (
                                <>
                                    <input className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" placeholder="Origen" value={expenseForm.origin} onChange={(e) => setExpenseForm({ ...expenseForm, origin: e.target.value })} />
                                    <input className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" placeholder="Destino" value={expenseForm.destination} onChange={(e) => setExpenseForm({ ...expenseForm, destination: e.target.value })} />
                                </>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 mt-3">
                            {expenseEditingId && <button onClick={() => { setExpenseEditingId(null); setExpenseForm({ type: 'PER_DIEM' as ObraExpenseType, date: '', amount: '', currency: 'EUR', employeeId: '', description: '', vendor: '', reference: '', origin: '', destination: '' }); }} className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Cancelar</button>}
                            <button disabled={closed && !expenseEditingId} onClick={handleSaveExpense} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-1.5"><Save size={14} /> Guardar gasto</button>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase text-slate-500">
                                <tr>
                                    <th className="px-4 py-3 text-left">Tipo</th>
                                    <th className="px-4 py-3 text-left">Fecha</th>
                                    <th className="px-4 py-3 text-left">Empleado</th>
                                    <th className="px-4 py-3 text-left">Descripción</th>
                                    <th className="px-4 py-3 text-right">Importe</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {(obra.expenses || []).map((e: any) => (
                                    <tr key={e.id}>
                                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${TIPO_COLORS[e.type as ObraExpenseType] || ''}`}>{TIPO_LABELS[e.type as ObraExpenseType] || e.type}</span></td>
                                        <td className="px-4 py-3">{String(e.date).substring(0, 10)}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{e.employee?.name || '—'}</td>
                                        <td className="px-4 py-3 text-slate-500 text-xs">{e.description || e.vendor || e.origin ? `${e.origin || ''}${e.origin && e.destination ? ' → ' : ''}${e.destination || ''}` : '—'}</td>
                                        <td className="px-4 py-3 text-right font-semibold">{Number(e.amount).toLocaleString('es-ES', { style: 'currency', currency: e.currency || 'EUR' })}</td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <button onClick={() => { setExpenseEditingId(e.id); setExpenseForm({ type: e.type as ObraExpenseType, date: String(e.date).substring(0, 10), amount: e.amount, currency: e.currency || 'EUR', employeeId: e.employeeId || '', description: e.description || '', vendor: e.vendor || '', reference: e.reference || '', origin: e.origin || '', destination: e.destination || '' }); }} className="text-blue-600 mr-2" aria-label="Editar"><Pencil size={14} /></button>
                                            <button onClick={() => handleDeleteExpense(e.id)} className="text-rose-600" aria-label="Eliminar"><Trash2 size={14} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {(!obra.expenses || obra.expenses.length === 0) && (
                                    <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Sin gastos. Añade uno o importa desde Excel.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
