import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import { Plus, Receipt, Filter, CheckCircle2, XCircle, Clock, FileText, CreditCard, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import ExpenseModal from '../components/expenses/ExpenseModal';

interface Expense {
    id: string;
    date: string;
    amount: number;
    category: string;
    description: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    paymentMethod: 'CASH' | 'COMPANY_CARD';
    receiptUrl?: string;
    employee?: {
        name: string;
        firstName: string;
        lastName: string;
    };
}

export default function ExpensesPage() {
    const { user, isAdmin, isManager } = useAuth();
    const [activeTab, setActiveTab] = useState<'my_expenses' | 'management'>('my_expenses');

    // Data State
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Filters
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

    useEffect(() => {
        fetchExpenses();
    }, [activeTab]);

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            let url = activeTab === 'my_expenses'
                ? `/expenses/employee/${user?.employeeId}`
                : '/expenses';

            // If checking management but no permission, fallback (safety)
            if (activeTab === 'management' && !isAdmin && !isManager) return;

            const res = await api.get(url);
            setExpenses(res.data || []);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar gastos');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        try {
            await api.put(`/expenses/${id}/status`, { status: newStatus });
            toast.success(`Gasto ${newStatus === 'APPROVED' ? 'aprobado' : 'rechazado'}`);
            fetchExpenses();
        } catch (error) {
            toast.error('No se pudo actualizar el estado');
        }
    };

    const StatusBadge = ({ status }: { status: string }) => {
        const styles = {
            PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
            APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
            REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800'
        };

        const icons = {
            PENDING: <Clock size={12} />,
            APPROVED: <CheckCircle2 size={12} />,
            REJECTED: <XCircle size={12} />
        };

        return (
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1.5 w-fit ${styles[status as keyof typeof styles]}`}>
                {icons[status as keyof typeof icons]}
                {status === 'PENDING' ? 'Pendiente' : status === 'APPROVED' ? 'Aprobado' : 'Rechazado'}
            </span>
        );
    };

    const filteredExpenses = expenses.filter(exp =>
        filterStatus === 'ALL' ? true : exp.status === filterStatus
    );

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">Gastos</span>
                        y Dietas
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Gestiona reembolsos y tickets digitalmente</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2 active:scale-95"
                    >
                        <Plus size={20} strokeWidth={2.5} />
                        Nuevo Gasto
                    </button>
                </div>
            </div>

            {/* Tabs */}
            {(isAdmin || isManager) && (
                <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-fit">
                    <button
                        onClick={() => setActiveTab('my_expenses')}
                        className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'my_expenses' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Mis Gastos
                    </button>
                    <button
                        onClick={() => setActiveTab('management')}
                        className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'management' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Gestión de Equipo
                    </button>
                </div>
            )}

            {/* Content */}
            <div className="bg-white dark:bg-slate-950 rounded-[32px] border border-slate-100 dark:border-slate-900 shadow-xl overflow-hidden min-h-[500px]">

                {/* Toolbar */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-900 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="pl-10 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
                            >
                                <option value="ALL">Todos los Estados</option>
                                <option value="PENDING">Pendientes</option>
                                <option value="APPROVED">Aprobados</option>
                                <option value="REJECTED">Rechazados</option>
                            </select>
                        </div>
                    </div>
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
                                    {activeTab === 'management' && <th className="px-6 py-4">Empleado</th>}
                                    <th className="px-6 py-4">Concepto</th>
                                    <th className="px-6 py-4">Categoría</th>
                                    <th className="px-6 py-4">Método</th>
                                    <th className="px-6 py-4 text-right">Importe</th>
                                    <th className="px-6 py-4 text-center">Estado</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                                {filteredExpenses.map((expense) => (
                                    <tr key={expense.id} className="group hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-sm font-medium text-slate-500">
                                            {new Date(expense.date).toLocaleDateString()}
                                        </td>
                                        {activeTab === 'management' && (
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-md">
                                                        {expense.employee?.firstName?.[0]}{expense.employee?.lastName?.[0]}
                                                    </div>
                                                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
                                                        {expense.employee?.firstName} {expense.employee?.lastName}
                                                    </span>
                                                </div>
                                            </td>
                                        )}
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
                                            {expense.amount.toFixed(2)}€
                                        </td>
                                        <td className="px-6 py-4 flex justify-center">
                                            <StatusBadge status={expense.status} />
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {expense.receiptUrl && (
                                                    <a
                                                        href={`http://localhost:3000${expense.receiptUrl}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-blue-600 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                                                        title="Ver Recibo"
                                                    >
                                                        <FileText size={16} />
                                                    </a>
                                                )}

                                                {activeTab === 'management' && expense.status === 'PENDING' && (
                                                    <div className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-800 ml-2">
                                                        <button
                                                            onClick={() => handleUpdateStatus(expense.id, 'APPROVED')}
                                                            className="p-2 hover:bg-green-50 text-slate-300 hover:text-green-600 rounded-xl transition-colors"
                                                            title="Aprobar"
                                                        >
                                                            <CheckCircle2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleUpdateStatus(expense.id, 'REJECTED')}
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
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {user?.employeeId && (
                <ExpenseModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={fetchExpenses}
                    employeeId={user.employeeId}
                />
            )}
        </div>
    );
}
