import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Briefcase, Calendar, DollarSign, Plus, Trash2, Pencil, Save, Upload, Users, Handshake, FileDown, Check, AlertTriangle, ChevronDown, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../api/client';
import { useConfirm } from '../context/ConfirmContext';
import { useApiUnwrap } from '../hooks/useApiUnwrap';
import { OBRA_EXPENSE_TYPES, type ObraExpenseType } from '@shared/obras';
import { downloadExpenseReceipts } from '../features/expenses/downloadExpenseReceipts';

const TIPOS: ObraExpenseType[] = [...OBRA_EXPENSE_TYPES];

const TIPO_LABELS: Record<ObraExpenseType, string> = {
    PER_DIEM: 'Dieta',
    LODGING: 'Hospedaje',
    FLIGHT: 'Vuelo',
    TRANSPORT: 'Transporte',
    CAR_RENTAL: 'Alquiler de coche',
    CONTRACTOR: 'Autónomo',
    OTHER: 'Otro'
};

const TIPO_COLORS: Record<ObraExpenseType, string> = {
    PER_DIEM: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    LODGING: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    FLIGHT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    TRANSPORT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    CAR_RENTAL: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    CONTRACTOR: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
    OTHER: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
};

const emptyExpenseForm = () => ({
    type: 'PER_DIEM' as ObraExpenseType,
    date: '',
    endDate: '',
    amount: '',
    currency: 'EUR',
    employeeIds: [] as string[],
    contractorIds: [] as string[],
    contractorId: '',
    description: '',
    vendor: '',
    reference: '',
    origin: '',
    destination: ''
});

type Tab = 'info' | 'hours' | 'expenses';

const inclusiveDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const from = new Date(`${start}T00:00:00Z`);
    const to = new Date(`${end}T00:00:00Z`);
    return Math.max(1, Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1);
};

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

interface EmployeeOption {
    id: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    dni?: string;
}

interface ContractorOption {
    id: string;
    name: string;
    nif?: string;
    active?: boolean;
}

export default function ObraDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const confirmAction = useConfirm();
    const unwrap = useApiUnwrap();
    const [obra, setObra] = useState<ObraShape | null>(null);
    const [employees, setEmployees] = useState<any[]>([]);
    const [contractors, setContractors] = useState<any[]>([]);
    const [tab, setTab] = useState<Tab>('info');
    const [loading, setLoading] = useState(false);
    const [hoursForm, setHoursForm] = useState({ employeeId: '', startDate: '', endDate: '', hours: 8, notes: '' });
    const [hoursEditingId, setHoursEditingId] = useState<string | null>(null);
    const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);
    const [expenseEditingId, setExpenseEditingId] = useState<string | null>(null);
    const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
    const [generatingReceipts, setGeneratingReceipts] = useState(false);
    const [employeeExpenseSearch, setEmployeeExpenseSearch] = useState('');
    const [contractorExpenseSearch, setContractorExpenseSearch] = useState('');

    // Filtros avanzados para los tabs de expenses y horas
    const [filters, setFilters] = useState({
        expenseType: '',
        employeeId: '',
        from: '',
        to: ''
    });
    const activeFilters = Object.values(filters).some(Boolean);

    const fetchObra = async (overrides?: Partial<typeof filters>) => {
        try {
            setLoading(true);
            const f = { ...filters, ...overrides };
            const params: Record<string, string> = {};
            if (f.expenseType) params.expenseType = f.expenseType;
            if (f.employeeId) params.employeeId = f.employeeId;
            if (f.from) params.from = f.from;
            if (f.to) params.to = f.to;
            const res = await api.get(`/obras/${id}`, { params });
            setObra(unwrap<ObraShape>(res));
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
            setEmployees(unwrap<EmployeeOption[]>(res) || []);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => { if (id) fetchObra(); }, [id]);
    useEffect(() => { fetchEmployees(); }, []);

    const fetchContractors = async () => {
        try {
            const res = await api.get('/obra-contractors', { params: { limit: 200 } });
            const data = unwrap<ContractorOption[] | { data?: ContractorOption[] }>(res);
            setContractors(Array.isArray(data) ? data : (data?.data ?? []));
        } catch (err) {
            console.error(err);
        }
    };
    useEffect(() => { fetchContractors(); }, []);

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
    const expenseDays = inclusiveDays(expenseForm.date, expenseForm.endDate);
    const selectedExpenseEmployees = employees.filter((employee) => expenseForm.employeeIds.includes(employee.id));
    const filteredExpenseEmployees = employees.filter((employee) => {
        const name = employee.name || `${employee.firstName || ''} ${employee.lastName || ''}`.trim();
        return `${name} ${employee.dni || ''}`.toLowerCase().includes(employeeExpenseSearch.trim().toLowerCase());
    });
    const selectedExpenseContractors = contractors.filter((c: any) => expenseForm.contractorIds.includes(c.id));
    const filteredExpenseContractors = contractors.filter((c: any) =>
        `${c.name || ''} ${c.nif || ''}`.toLowerCase().includes(contractorExpenseSearch.trim().toLowerCase())
    );
    const totalExpensePeople = expenseForm.employeeIds.length + expenseForm.contractorIds.length;
    const dietGrandTotal = Number(expenseForm.amount || 0) * expenseDays * totalExpensePeople;

    const handleSaveExpense = async () => {
        if (!expenseForm.date || !expenseForm.endDate || !expenseForm.amount) return toast.error('Las fechas y el importe son obligatorios');
        if (expenseForm.endDate < expenseForm.date) return toast.error('La fecha fin debe ser igual o posterior al inicio');
        const amountNum = Number(expenseForm.amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) return toast.error('Importe debe ser > 0');
        if (expenseForm.type === 'PER_DIEM' && !expenseForm.destination.trim()) return toast.error('Indica el destino del viaje');
        if (expenseForm.type === 'PER_DIEM' && totalExpensePeople === 0) return toast.error('Selecciona al menos un empleado o autónomo para la dieta');
        if (expenseForm.type === 'CONTRACTOR' && !expenseForm.contractorId) return toast.error('Selecciona el autónomo');
        try {
            const payload: any = {
                type: expenseForm.type,
                date: expenseForm.date,
                endDate: expenseForm.endDate,
                amount: amountNum,
                amountMode: expenseForm.type === 'PER_DIEM' ? 'PER_EMPLOYEE_DAY' : 'TOTAL_SPLIT',
                currency: expenseForm.currency || 'EUR',
                ...(expenseForm.type === 'CONTRACTOR'
                    ? expenseEditingId
                        ? { employeeId: null }
                        : {}
                    : expenseEditingId
                        ? { employeeId: expenseForm.employeeIds[0] || null }
                        : expenseForm.employeeIds.length > 0
                            ? { employeeIds: expenseForm.employeeIds }
                            : {}),
                ...(expenseForm.type === 'CONTRACTOR'
                    ? { contractorId: expenseForm.contractorId || null }
                    : expenseEditingId
                        ? { contractorId: expenseForm.contractorIds[0] || null }
                        : expenseForm.contractorIds.length > 0
                            ? { contractorIds: expenseForm.contractorIds }
                            : {}),
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
            setExpenseForm(emptyExpenseForm());
            setEmployeeExpenseSearch('');
            setContractorExpenseSearch('');
            setExpenseEditingId(null);
            fetchObra();
        } catch (err: any) {
            toast.error(getErrorMessage(err, 'Error al guardar gasto'));
        }
    };

    const toggleExpenseEmployee = (employeeId: string) => {
        setExpenseForm((current) => ({
            ...current,
            employeeIds: current.employeeIds.includes(employeeId)
                ? current.employeeIds.filter((id) => id !== employeeId)
                : [...current.employeeIds, employeeId]
        }));
    };

    const toggleExpenseContractor = (contractorId: string) => {
        setExpenseForm((current) => ({
            ...current,
            contractorIds: current.contractorIds.includes(contractorId)
                ? current.contractorIds.filter((id) => id !== contractorId)
                : [...current.contractorIds, contractorId]
        }));
    };

    const handleGenerateReceipts = async () => {
        if (selectedExpenseIds.length === 0) return toast.error('Selecciona al menos un gasto con empleado');
        try {
            setGeneratingReceipts(true);
            await downloadExpenseReceipts(selectedExpenseIds);
            toast.success(selectedExpenseIds.length === 1 ? 'Recibí generado' : `${selectedExpenseIds.length} recibís generados`);
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, 'No se pudieron generar los recibís'));
        } finally {
            setGeneratingReceipts(false);
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

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
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

            {(tab === 'hours' || tab === 'expenses') && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo gasto</label>
                        <select
                            className="px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs"
                            value={filters.expenseType}
                            onChange={(e) => { setFilters({ ...filters, expenseType: e.target.value }); fetchObra({ expenseType: e.target.value, employeeId: '', from: '', to: '' }); }}
                        >
                            <option value="">Todos</option>
                            {TIPOS.map((t) => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Empleado</label>
                        <select
                            className="px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs"
                            value={filters.employeeId}
                            onChange={(e) => { setFilters({ ...filters, employeeId: e.target.value }); fetchObra({ ...filters, employeeId: e.target.value }); }}
                        >
                            <option value="">Todos</option>
                            {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name || `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.dni}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Desde</label>
                        <input type="date" className="px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs" value={filters.from} onChange={(e) => { setFilters({ ...filters, from: e.target.value }); fetchObra({ ...filters, from: e.target.value }); }} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Hasta</label>
                        <input type="date" className="px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs" value={filters.to} onChange={(e) => { setFilters({ ...filters, to: e.target.value }); fetchObra({ ...filters, to: e.target.value }); }} />
                    </div>
                    {activeFilters && (
                        <button
                            onClick={() => { setFilters({ expenseType: '', employeeId: '', from: '', to: '' }); fetchObra({ expenseType: '', employeeId: '', from: '', to: '' }); }}
                            className="text-xs px-3 py-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg"
                        >
                            Limpiar filtros
                        </button>
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
                            <AlertTriangle size={16} className="mr-2 inline-block" />
                            Esta obra está cerrada. No se pueden añadir nuevos gastos; las correcciones siguen permitidas.
                        </div>
                    )}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                        <h3 className="font-bold mb-3 flex items-center gap-1.5"><Plus size={16} /> {expenseEditingId ? 'Editar gasto' : 'Añadir gasto manual'}</h3>
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                            <label className="space-y-1 lg:col-span-3">
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Categoría</span>
                                <select className="min-h-11 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" value={expenseForm.type} onChange={(e) => {
                                    const type = e.target.value as ObraExpenseType;
                                    setExpenseForm({ ...expenseForm, type, destination: type === 'PER_DIEM' ? (expenseForm.destination || obra.destination || '') : expenseForm.destination });
                                }}>
                                {TIPOS.map((t) => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                                </select>
                            </label>
                            <label className="space-y-1 lg:col-span-3">
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Desde</span>
                                <input type="date" className="min-h-11 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value, endDate: expenseForm.endDate || e.target.value })} />
                            </label>
                            <label className="space-y-1 lg:col-span-3">
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Hasta</span>
                                <input type="date" min={expenseForm.date} className="min-h-11 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" value={expenseForm.endDate} onChange={(e) => setExpenseForm({ ...expenseForm, endDate: e.target.value })} />
                            </label>
                            <label className="space-y-1 lg:col-span-3">
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    {expenseForm.type === 'PER_DIEM' ? 'Importe por empleado y día' : 'Importe total a repartir'}
                                </span>
                                <input type="number" step="0.01" min="0.01" className="min-h-11 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} placeholder="0,00 €" />
                            </label>

                            {expenseForm.type !== 'CONTRACTOR' && (
                            <details className="group relative lg:col-span-12">
                                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                                    <span className="flex min-w-0 items-center gap-2">
                                        <Users size={16} className="shrink-0 text-slate-500" />
                                        <span className="truncate">
                                            {selectedExpenseEmployees.length === 0
                                                ? 'Seleccionar empleados…'
                                                : selectedExpenseEmployees.length === 1
                                                    ? (selectedExpenseEmployees[0].name || selectedExpenseEmployees[0].dni)
                                                    : `${selectedExpenseEmployees.length} empleados seleccionados`}
                                        </span>
                                    </span>
                                    <ChevronDown size={16} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                                    <div className="relative mb-2">
                                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="search"
                                            value={employeeExpenseSearch}
                                            onChange={(event) => setEmployeeExpenseSearch(event.target.value)}
                                            placeholder="Buscar por nombre o DNI"
                                            className="min-h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                                        />
                                    </div>
                                    {!expenseEditingId && (
                                        <button
                                            type="button"
                                            onClick={() => setExpenseForm((current) => ({
                                                ...current,
                                                employeeIds: filteredExpenseEmployees.every((employee) => current.employeeIds.includes(employee.id))
                                                    ? current.employeeIds.filter((id) => !filteredExpenseEmployees.some((employee) => employee.id === id))
                                                    : Array.from(new Set([...current.employeeIds, ...filteredExpenseEmployees.map((employee) => employee.id)]))
                                            }))}
                                            className="mb-2 min-h-9 rounded-md px-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                                        >
                                            {filteredExpenseEmployees.every((employee) => expenseForm.employeeIds.includes(employee.id)) ? 'Quitar resultados' : 'Seleccionar resultados'}
                                        </button>
                                    )}
                                    <div className="max-h-56 overflow-y-auto">
                                        {filteredExpenseEmployees.map((employee: any) => {
                                            const selected = expenseForm.employeeIds.includes(employee.id);
                                            const name = employee.name || `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.dni;
                                            return (
                                                <button
                                                    key={employee.id}
                                                    type="button"
                                                    disabled={Boolean(expenseEditingId && !selected)}
                                                    onClick={() => toggleExpenseEmployee(employee.id)}
                                                    className={`flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm ${selected ? 'bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-100' : 'hover:bg-slate-50 dark:hover:bg-slate-800'} disabled:opacity-40`}
                                                >
                                                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>{selected && <Check size={13} />}</span>
                                                    <span className="truncate">{name}</span>
                                                    <span className="ml-auto text-xs text-slate-400">{employee.dni}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </details>
                            )}

                            {expenseForm.type !== 'CONTRACTOR' && (
                            <details className="group relative lg:col-span-12">
                                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                                    <span className="flex min-w-0 items-center gap-2">
                                        <Handshake size={16} className="shrink-0 text-slate-500" />
                                        <span className="truncate">
                                            {selectedExpenseContractors.length === 0
                                                ? 'Seleccionar autónomos…'
                                                : selectedExpenseContractors.length === 1
                                                    ? (selectedExpenseContractors[0].name || selectedExpenseContractors[0].nif)
                                                    : `${selectedExpenseContractors.length} autónomos seleccionados`}
                                        </span>
                                    </span>
                                    <ChevronDown size={16} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                                    <div className="relative mb-2">
                                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="search"
                                            value={contractorExpenseSearch}
                                            onChange={(event) => setContractorExpenseSearch(event.target.value)}
                                            placeholder="Buscar por nombre o NIF"
                                            className="min-h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                                        />
                                    </div>
                                    {!expenseEditingId && (
                                        <button
                                            type="button"
                                            onClick={() => setExpenseForm((current) => ({
                                                ...current,
                                                contractorIds: filteredExpenseContractors.every((c) => current.contractorIds.includes(c.id))
                                                    ? current.contractorIds.filter((id) => !filteredExpenseContractors.some((c) => c.id === id))
                                                    : Array.from(new Set([...current.contractorIds, ...filteredExpenseContractors.map((c) => c.id)]))
                                            }))}
                                            className="mb-2 min-h-9 rounded-md px-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                                        >
                                            {filteredExpenseContractors.every((c) => expenseForm.contractorIds.includes(c.id)) ? 'Quitar resultados' : 'Seleccionar resultados'}
                                        </button>
                                    )}
                                    <div className="max-h-56 overflow-y-auto">
                                        {filteredExpenseContractors.map((c: any) => {
                                            const selected = expenseForm.contractorIds.includes(c.id);
                                            return (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    disabled={Boolean(expenseEditingId && !selected)}
                                                    onClick={() => toggleExpenseContractor(c.id)}
                                                    className={`flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm ${selected ? 'bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-100' : 'hover:bg-slate-50 dark:hover:bg-slate-800'} disabled:opacity-40`}
                                                >
                                                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>{selected && <Check size={13} />}</span>
                                                    <span className="truncate">{c.name}</span>
                                                    <span className="ml-auto text-xs text-slate-400">{c.nif}</span>
                                                </button>
                                            );
                                        })}
                                        {filteredExpenseContractors.length === 0 && (
                                            <p className="px-2 py-3 text-xs text-slate-400">No hay autónomos dados de alta.</p>
                                        )}
                                    </div>
                                </div>
                            </details>
                            )}

                            {expenseForm.type === 'CONTRACTOR' && (
                                <label className="space-y-1 lg:col-span-12">
                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Autónomo *</span>
                                    <select
                                        className="min-h-11 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800"
                                        value={expenseForm.contractorId}
                                        onChange={(e) => setExpenseForm({ ...expenseForm, contractorId: e.target.value })}
                                    >
                                        <option value="">Seleccionar autónomo...</option>
                                        {contractors
                                            .filter((c: any) => c.active !== false)
                                            .map((c: any) => (
                                                <option key={c.id} value={c.id}>{c.name} ({c.nif})</option>
                                            ))}
                                    </select>
                                </label>
                            )}

                            {expenseForm.type === 'PER_DIEM' ? (
                                <div className="lg:col-span-12 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                                    <strong>{Number(expenseForm.amount || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</strong> × {expenseDays || 0} día{expenseDays === 1 ? '' : 's'} × {totalExpensePeople} {totalExpensePeople === 1 ? 'persona' : 'personas'} = <strong>{dietGrandTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</strong>
                                </div>
                            ) : totalExpensePeople > 0 && Number(expenseForm.amount) > 0 ? (
                                <div className="lg:col-span-12 text-xs text-slate-600">
                                    Cada {selectedExpenseContractors.length > 0 ? 'persona' : 'empleado'} recibirá aproximadamente {(Number(expenseForm.amount) / totalExpensePeople).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}.
                                </div>
                            ) : null}
                            <input className="min-h-11 px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 lg:col-span-6" placeholder="Descripción" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} />
                            <input className="min-h-11 px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 lg:col-span-3" placeholder="Proveedor" value={expenseForm.vendor} onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })} />
                            <input className="min-h-11 px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 lg:col-span-3" placeholder="Referencia" value={expenseForm.reference} onChange={(e) => setExpenseForm({ ...expenseForm, reference: e.target.value })} />
                            <label className="space-y-1 lg:col-span-6">
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Origen (opcional)</span>
                                <input className="min-h-11 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" placeholder="Lugar de salida" value={expenseForm.origin} onChange={(e) => setExpenseForm({ ...expenseForm, origin: e.target.value })} />
                            </label>
                            <label className="space-y-1 lg:col-span-6">
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Destino {expenseForm.type === 'PER_DIEM' ? '(obligatorio)' : ''}</span>
                                <input className="min-h-11 w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800" placeholder={obra.destination || 'Lugar de destino'} value={expenseForm.destination} onChange={(e) => setExpenseForm({ ...expenseForm, destination: e.target.value })} />
                            </label>
                        </div>
                        <div className="flex justify-end gap-2 mt-3">
                            {expenseEditingId && <button onClick={() => { setExpenseEditingId(null); setExpenseForm(emptyExpenseForm()); }} className="min-h-11 px-3 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Cancelar</button>}
                            <button disabled={closed && !expenseEditingId} onClick={handleSaveExpense} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-1.5"><Save size={14} /> Guardar gasto</button>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                            <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">Gastos registrados</p>
                                <p className="text-xs text-slate-500">Selecciona filas con empleado para generar un recibí por persona.</p>
                            </div>
                            <button type="button" disabled={selectedExpenseIds.length === 0 || generatingReceipts} onClick={handleGenerateReceipts} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-900">
                                <FileDown size={16} /> {generatingReceipts ? 'Generando…' : `Generar recibís (${selectedExpenseIds.length})`}
                            </button>
                        </div>
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase text-slate-500">
                                <tr>
                                    <th className="w-12 px-4 py-3 text-left">
                                        <input
                                            type="checkbox"
                                            aria-label="Seleccionar todos los gastos con empleado"
                                            checked={(obra.expenses || []).filter((expense: any) => expense.employeeId).length > 0 && (obra.expenses || []).filter((expense: any) => expense.employeeId).every((expense: any) => selectedExpenseIds.includes(expense.id))}
                                            onChange={(event) => setSelectedExpenseIds(event.target.checked ? (obra.expenses || []).filter((expense: any) => expense.employeeId).map((expense: any) => expense.id) : [])}
                                        />
                                    </th>
                                    <th className="px-4 py-3 text-left">Tipo</th>
                                    <th className="px-4 py-3 text-left">Periodo</th>
                                    <th className="px-4 py-3 text-left">Empleado / Autónomo</th>
                                    <th className="px-4 py-3 text-left">Descripción</th>
                                    <th className="px-4 py-3 text-right">Importe</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {(obra.expenses || []).map((e: any) => (
                                    <tr key={e.id}>
                                        <td className="px-4 py-3">
                                            <input type="checkbox" disabled={!e.employeeId} aria-label={`Seleccionar gasto ${e.id}`} checked={selectedExpenseIds.includes(e.id)} onChange={() => setSelectedExpenseIds((current) => current.includes(e.id) ? current.filter((id) => id !== e.id) : [...current, e.id])} />
                                        </td>
                                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${TIPO_COLORS[e.type as ObraExpenseType] || ''}`}>{TIPO_LABELS[e.type as ObraExpenseType] || e.type}</span></td>
                                        <td className="px-4 py-3">{String(e.date).substring(0, 10)}{e.endDate && String(e.endDate).substring(0, 10) !== String(e.date).substring(0, 10) ? ` → ${String(e.endDate).substring(0, 10)}` : ''}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                            {e.contractor?.name ? (
                                                <>
                                                    <span>{e.contractor.name}</span>
                                                    <span className="block text-[10px] font-normal text-slate-400">{e.contractor.nif}</span>
                                                </>
                                            ) : e.employee?.name || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 text-xs">{e.description || e.vendor || e.origin ? `${e.origin || ''}${e.origin && e.destination ? ' → ' : ''}${e.destination || ''}` : '—'}</td>
                                        <td className="px-4 py-3 text-right font-semibold">
                                            {Number(e.amount).toLocaleString('es-ES', { style: 'currency', currency: e.currency || 'EUR' })}
                                            {e.type === 'PER_DIEM' && e.unitAmount && <span className="block text-[10px] font-normal text-slate-500">{Number(e.unitAmount).toLocaleString('es-ES', { style: 'currency', currency: e.currency || 'EUR' })}/día × {e.unitCount || 1}</span>}
                                            {Number(e.allocationCount || 1) > 1 && <span className="block text-[10px] font-normal text-slate-400">Reparto {e.allocationIndex}/{e.allocationCount}</span>}
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <button onClick={() => { setExpenseEditingId(e.id); setExpenseForm({ type: e.type as ObraExpenseType, date: String(e.date).substring(0, 10), endDate: String(e.endDate || e.date).substring(0, 10), amount: e.type === 'PER_DIEM' && e.unitAmount ? e.unitAmount : e.amount, currency: e.currency || 'EUR', employeeIds: e.employeeId ? [e.employeeId] : [], contractorIds: e.contractorId ? [e.contractorId] : [], contractorId: e.contractorId || '', description: e.description || '', vendor: e.vendor || '', reference: e.sourceReference || e.reference || '', origin: e.origin || '', destination: e.destination || '' }); }} className="text-blue-600 mr-2" aria-label="Editar"><Pencil size={14} /></button>
                                            <button onClick={() => handleDeleteExpense(e.id)} className="text-rose-600" aria-label="Eliminar"><Trash2 size={14} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {(!obra.expenses || obra.expenses.length === 0) && (
                                    <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Sin gastos. Añade uno o importa desde Excel.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
