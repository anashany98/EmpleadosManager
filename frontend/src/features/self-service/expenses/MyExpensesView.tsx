import { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, DollarSign, FileText, Filter, Plus, Receipt, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL, api } from '../../../api/client';
import { useAuth } from '../../../contexts/AuthContext';
import { SearchInput } from '../../../components/ui/SearchInput';
import ExpenseModal from '../../../components/expenses/ExpenseModal';
import { ExpenseStatusBadge } from './ExpenseStatusBadge';
import { normalizeExpenseListResponse } from './utils';
import type { Expense } from './types';

export function MyExpensesView() {
    const { user } = useAuth();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const LIMIT = 20;

    const fetchExpenses = useCallback(async () => {
        if (!user?.employeeId) {
            setExpenses([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const response = await api.get(`/expenses/employee/${user.employeeId}`);
            setExpenses(normalizeExpenseListResponse(response));
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar gastos');
        } finally {
            setLoading(false);
        }
    }, [user?.employeeId]);

    useEffect(() => {
        void fetchExpenses();
    }, [fetchExpenses]);

    const filteredExpenses = useMemo(() => {
        return expenses.filter((expense) => {
            const matchesStatus = filterStatus === 'ALL' || expense.status === filterStatus;
            const lowerSearch = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm ||
                expense.description.toLowerCase().includes(lowerSearch) ||
                expense.category.toLowerCase().includes(lowerSearch);
            return matchesStatus && matchesSearch;
        });
    }, [expenses, filterStatus, searchTerm]);

    const totalPages = Math.ceil(filteredExpenses.length / LIMIT);
    const paginatedExpenses = filteredExpenses.slice((page - 1) * LIMIT, page * LIMIT);

    useEffect(() => {
        if (page > totalPages && totalPages > 0) {
            setPage(1);
        }
    }, [totalPages, page]);

    if (!user?.employeeId) {
        return (
            <div className="bg-white dark:bg-slate-950 rounded-[32px] border border-slate-100 dark:border-slate-900 shadow-xl p-8 text-slate-500">
                No tienes un perfil de empleado asociado para autoservicio.
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Mis gastos</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Reembolsos y tickets desde autoservicio.</p>
                </div>

                <button
                    onClick={() => setIsModalOpen(true)}
                    className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2 active:scale-95"
                >
                    <Plus size={20} strokeWidth={2.5} />
                    Nuevo gasto
                </button>
            </div>

            <div className="bg-white dark:bg-slate-950 rounded-[32px] border border-slate-100 dark:border-slate-900 shadow-xl overflow-hidden min-h-[500px]">
                <div className="p-6 border-b border-slate-100 dark:border-slate-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <select
                            value={filterStatus}
                            onChange={(event) => setFilterStatus(event.target.value)}
                            className="pl-10 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
                        >
                            <option value="ALL">Todos los estados</option>
                            <option value="PENDING">Pendientes</option>
                            <option value="APPROVED">Aprobados</option>
                            <option value="REJECTED">Rechazados</option>
                        </select>
                    </div>
                    <SearchInput
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Buscar por concepto o categoría..."
                        className="w-full sm:w-64"
                    />
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center h-96 gap-4">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-slate-400 font-medium text-sm animate-pulse">Cargando gastos...</p>
                    </div>
                ) : filteredExpenses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-96 gap-6 text-center">
                        <div className="w-24 h-24 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center">
                            <Receipt size={48} className="text-slate-300" />
                        </div>
                        <div>
                            <p className="text-slate-900 dark:text-white font-bold text-lg">No hay gastos registrados</p>
                            <p className="text-slate-500 text-sm mt-1">Sube tu primer ticket para empezar.</p>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-[11px] font-black uppercase tracking-wider">
                                    <th className="px-6 py-4">Fecha</th>
                                    <th className="px-6 py-4">Concepto</th>
                                    <th className="px-6 py-4">Categoria</th>
                                    <th className="px-6 py-4">Metodo</th>
                                    <th className="px-6 py-4 text-right">Importe</th>
                                    <th className="px-6 py-4 text-center">Estado</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                                {paginatedExpenses.map((expense) => (
                                    <tr key={expense.id} className="group hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-sm font-medium text-slate-500">
                                            {new Date(expense.date).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-medium text-slate-900 dark:text-white line-clamp-1">{expense.description}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">
                                                {expense.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                                {expense.paymentMethod === 'CASH' ? <DollarSign size={14} /> : <CreditCard size={14} />}
                                                {expense.paymentMethod === 'CASH' ? 'Reembolso' : 'Tarjeta'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                                            {expense.amount.toFixed(2)} EUR
                                        </td>
                                        <td className="px-6 py-4 flex justify-center">
                                            <ExpenseStatusBadge status={expense.status} />
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {expense.receiptUrl && (
                                                <a
                                                    href={`${API_URL}/expenses/${expense.id}/receipt`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-blue-600 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                                                    title="Ver recibo"
                                                >
                                                    <FileText size={16} />
                                                </a>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {filteredExpenses.length > LIMIT && (
                            <div className="p-4 border-t border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                    Página {page} de {totalPages}
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        disabled={page === 1}
                                        onClick={() => setPage(p => p - 1)}
                                        className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 disabled:opacity-50 hover:border-blue-500 transition-colors shadow-sm"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <button
                                        disabled={page === totalPages}
                                        onClick={() => setPage(p => p + 1)}
                                        className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 disabled:opacity-50 hover:border-blue-500 transition-colors shadow-sm"
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <ExpenseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => void fetchExpenses()}
                employeeId={user.employeeId}
            />
        </div>
    );
}
