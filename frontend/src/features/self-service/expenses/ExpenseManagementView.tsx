import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, CreditCard, DollarSign, FileText, Filter, Plus, Receipt, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL, api } from '../../../api/client';
import { SearchInput } from '../../../components/ui/SearchInput';
import ExpenseModal from '../../../components/expenses/ExpenseModal';
import { useConfirm } from '../../../context/ConfirmContext';
import { ExpenseStatusBadge } from './ExpenseStatusBadge';
import { normalizeEmployeeOptionsResponse, normalizeExpenseListResponse } from './utils';
import type { Expense, ExpenseEmployeeOption } from './types';
import { getEmployeeDisplayName, getEmployeeInitials } from '../../../utils/employeeDisplay';

export function ExpenseManagementView() {
    const confirmAction = useConfirm();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [employees, setEmployees] = useState<ExpenseEmployeeOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const LIMIT = 20;

    useEffect(() => {
        setPage(1);
    }, [filterStatus, searchTerm]);

    useEffect(() => {
        void fetchExpenses();
        void fetchEmployees();
    }, []);

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            const response = await api.get('/expenses');
            setExpenses(normalizeExpenseListResponse(response));
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar gastos');
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const response = await api.get('/employees');
            setEmployees(normalizeEmployeeOptionsResponse(response));
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar empleados');
        }
    };

    const handleUpdateStatus = async (expenseId: string, newStatus: string) => {
        try {
            await api.put(`/expenses/${expenseId}/status`, { status: newStatus });
            toast.success(`Gasto ${newStatus === 'APPROVED' ? 'aprobado' : 'rechazado'}`);
            await fetchExpenses();
        } catch (error) {
            console.error(error);
            toast.error('No se pudo actualizar el estado');
        }
    };

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

    const paginatedExpenses = useMemo(() => {
        const start = (page - 1) * LIMIT;
        return filteredExpenses.slice(start, start + LIMIT);
    }, [filteredExpenses, page]);

    const totalPages = Math.ceil(filteredExpenses.length / LIMIT);

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Backoffice de gastos</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Revision, aprobacion y seguimiento de reembolsos del equipo.</p>
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
                            <p className="text-slate-500 text-sm mt-1">Todavia no hay gastos en el equipo.</p>
                        </div>
                    </div>
                ) : (
                    <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-[11px] font-black uppercase tracking-wider">
                                    <th className="px-6 py-4">Fecha</th>
                                    <th className="px-6 py-4">Empleado</th>
                                    <th className="px-6 py-4">Concepto</th>
                                    <th className="px-6 py-4">Categoria</th>
                                    <th className="px-6 py-4">Metodo</th>
                                    <th className="px-6 py-4 text-right">Importe</th>
                                    <th className="px-6 py-4 text-center">Estado</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                                {paginatedExpenses.map((expense) => {
                                    const employeeName = getEmployeeDisplayName(expense.employee, 'Empleado');

                                    return (
                                    <tr key={expense.id} className="group hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-sm font-medium text-slate-500">
                                            {new Date(expense.date).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-md">
                                                    {getEmployeeInitials(expense.employee, '?')}
                                                </div>
                                                <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
                                                    {employeeName}
                                                </span>
                                            </div>
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
                                            <div className="flex items-center justify-end gap-2">
                                                {expense.receiptUrl && (
                                                    <a
                                                        href={`${API_URL}/expenses/${expense.id}/receipt`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-blue-600 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                                                        title="Ver recibo"
                                                    >
                                                        <FileText size={16} />
                                                    </a>
                                                )}

                                                {expense.status === 'PENDING' && (
                                                    <div className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-800 ml-2">
                                                        <button
                                                            onClick={async () => {
                                                                const confirmed = await confirmAction({
                                                                    title: 'Aprobar gasto',
                                                                    message: `¿Confirmar la aprobación del gasto de ${expense.amount.toFixed(2)} EUR?`,
                                                                    confirmText: 'Aprobar',
                                                                    cancelText: 'Cancelar',
                                                                    type: 'warning'
                                                                });
                                                                if (confirmed) {
                                                                    void handleUpdateStatus(expense.id, 'APPROVED');
                                                                }
                                                            }}
                                                            className="p-2 hover:bg-green-50 text-slate-300 hover:text-green-600 rounded-xl transition-colors"
                                                            title="Aprobar"
                                                        >
                                                            <CheckCircle2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                const confirmed = await confirmAction({
                                                                    title: 'Rechazar gasto',
                                                                    message: `¿Confirmar el rechazo del gasto de ${expense.amount.toFixed(2)} EUR?`,
                                                                    confirmText: 'Rechazar',
                                                                    cancelText: 'Cancelar',
                                                                    type: 'warning'
                                                                });
                                                                if (confirmed) {
                                                                    void handleUpdateStatus(expense.id, 'REJECTED');
                                                                }
                                                            }}
                                                            className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-xl transition-colors"
                                                            title="Rechazar"
                                                        >
                                                            <XCircle size={16} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    </div>
                    {totalPages > 1 ? (
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
                    ) : null}
                    </>
                )}
            </div>

            <ExpenseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => void fetchExpenses()}
                employees={employees}
            />
        </div>
    );
}
