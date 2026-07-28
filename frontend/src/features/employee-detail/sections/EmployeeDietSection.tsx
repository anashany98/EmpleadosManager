import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, FileDown, RefreshCw, Receipt, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../../../api/client';
import { downloadExpenseReceipts } from '../../expenses/downloadExpenseReceipts';
import { OBRA_TYPE_LABELS, type ObraExpenseType } from '@shared/obras';

interface EmployeeObraExpense {
    id: string;
    type: ObraExpenseType;
    date: string;
    endDate?: string | null;
    amount: string | number;
    originalAmount?: string | number | null;
    unitAmount?: string | number | null;
    unitCount?: number;
    allocationCount?: number;
    allocationIndex?: number | null;
    currency?: string;
    description?: string | null;
    obra: {
        id: string;
        code: string;
        name: string;
    };
}

const formatMoney = (value: string | number, currency = 'EUR') => Number(value).toLocaleString('es-ES', {
    style: 'currency',
    currency
});

export function EmployeeDietSection({ employeeId }: { employeeId: string }) {
    const [expenses, setExpenses] = useState<EmployeeObraExpense[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/obra-expenses', {
                params: { employeeId, limit: 500 }
            });
            setExpenses(response.data?.data || response.data || []);
        } catch (loadError: unknown) {
            setError(getErrorMessage(loadError, 'No se pudieron cargar las dietas y gastos'));
        } finally {
            setLoading(false);
        }
    }, [employeeId]);

    useEffect(() => {
        void load();
    }, [load]);

    const categories = useMemo(() => Array.from(new Set(expenses.map((expense) => expense.type))), [expenses]);
    const filtered = useMemo(() => expenses.filter((expense) => {
        if (category && expense.type !== category) return false;
        const text = `${OBRA_TYPE_LABELS[expense.type] || expense.type} ${expense.obra.code} ${expense.obra.name} ${expense.description || ''}`.toLowerCase();
        return !query.trim() || text.includes(query.trim().toLowerCase());
    }), [category, expenses, query]);
    const total = filtered.reduce((sum, expense) => sum + Number(expense.amount), 0);

    const generate = async () => {
        if (selectedIds.length === 0) return;
        try {
            setGenerating(true);
            await downloadExpenseReceipts(selectedIds);
            toast.success(selectedIds.length === 1 ? 'Recibí generado' : `${selectedIds.length} recibís generados`);
        } catch (generateError: unknown) {
            toast.error(getErrorMessage(generateError, 'No se pudieron generar los recibís'));
        } finally {
            setGenerating(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-sm text-slate-500">Cargando dietas y gastos…</div>;
    }
    if (error) {
        return (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900 dark:bg-rose-950/30">
                <p className="font-semibold text-rose-800 dark:text-rose-200">{error}</p>
                <button type="button" onClick={() => void load()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-rose-700 px-4 text-sm font-semibold text-white">
                    <RefreshCw size={16} /> Reintentar
                </button>
            </div>
        );
    }

    return (
        <section className="space-y-4" aria-label="Dietas y gastos de obra">
            <header className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">Obras</p>
                        <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">Dietas y gastos asignados</h2>
                        <p className="mt-1 text-sm text-slate-500">Estos datos proceden directamente de los gastos registrados en cada obra.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{filtered.length} registros</span>
                        <span className="rounded-lg bg-emerald-100 px-3 py-2 text-sm font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">{formatMoney(total)}</span>
                        <button type="button" onClick={generate} disabled={selectedIds.length === 0 || generating} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-950">
                            <FileDown size={16} /> {generating ? 'Generando…' : `Generar recibís (${selectedIds.length})`}
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row">
                <label className="relative flex-1">
                    <span className="sr-only">Buscar gasto</span>
                    <Search className="absolute left-3 top-3 text-slate-400" size={17} />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por obra, categoría o detalle" className="min-h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950" />
                </label>
                <label>
                    <span className="sr-only">Filtrar categoría</span>
                    <select value={category} onChange={(event) => setCategory(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 sm:w-56">
                        <option value="">Todas las categorías</option>
                        {categories.map((type) => <option key={type} value={type}>{OBRA_TYPE_LABELS[type] || type}</option>)}
                    </select>
                </label>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="overflow-x-auto">
                    <table className="min-w-[900px] w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800">
                            <tr>
                                <th className="w-12 px-4 py-3">
                                    <input type="checkbox" aria-label="Seleccionar todos los gastos visibles" checked={filtered.length > 0 && filtered.every((expense) => selectedIds.includes(expense.id))} onChange={(event) => setSelectedIds(event.target.checked ? filtered.map((expense) => expense.id) : [])} />
                                </th>
                                <th className="px-4 py-3 text-left">Categoría</th>
                                <th className="px-4 py-3 text-left">Periodo</th>
                                <th className="px-4 py-3 text-left">Obra</th>
                                <th className="px-4 py-3 text-left">Detalle</th>
                                <th className="px-4 py-3 text-right">Importe</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filtered.map((expense) => {
                                const selected = selectedIds.includes(expense.id);
                                return (
                                    <tr key={expense.id} className={selected ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}>
                                        <td className="px-4 py-3">
                                            <button type="button" onClick={() => setSelectedIds((current) => selected ? current.filter((id) => id !== expense.id) : [...current, expense.id])} className={`flex h-6 w-6 items-center justify-center rounded border ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 dark:border-slate-600'}`} aria-label={`${selected ? 'Deseleccionar' : 'Seleccionar'} ${expense.obra.name}`} aria-pressed={selected}>
                                                {selected && <Check size={14} />}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{OBRA_TYPE_LABELS[expense.type] || expense.type}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{expense.date.slice(0, 10)}{expense.endDate && expense.endDate.slice(0, 10) !== expense.date.slice(0, 10) ? ` → ${expense.endDate.slice(0, 10)}` : ''}</td>
                                        <td className="px-4 py-3"><span className="font-mono text-xs text-blue-700 dark:text-blue-300">{expense.obra.code}</span><span className="ml-2 text-slate-700 dark:text-slate-200">{expense.obra.name}</span></td>
                                        <td className="max-w-xs truncate px-4 py-3 text-slate-500">{expense.description || '—'}</td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                                            {formatMoney(expense.amount, expense.currency)}
                                            {expense.type === 'PER_DIEM' && expense.unitAmount && <span className="block text-[10px] font-normal text-slate-500">{formatMoney(expense.unitAmount, expense.currency)}/día × {expense.unitCount || 1}</span>}
                                            {(expense.allocationCount || 1) > 1 && <span className="block text-[10px] font-normal text-slate-400">Parte {expense.allocationIndex}/{expense.allocationCount} de {formatMoney(expense.originalAmount || expense.amount, expense.currency)}</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500"><Receipt className="mx-auto mb-3 text-slate-300" size={28} />No hay gastos asignados con estos filtros.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
