import { useState, useEffect } from 'react';
import { api, API_URL } from '../api/client';
import { toast } from 'sonner';
import {
    Trash2,
    Calendar,
    CheckCircle2,
    XCircle,
    Plus,
    X,
    Loader2,
    DollarSign,
    ExternalLink,
    Receipt,
    Upload
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Expense {
    id: string;
    employeeId: string;
    category: string;
    amount: number;
    description: string | null;
    date: string;
    receiptUrl: string | null;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    paymentMethod: string;
    createdAt: string;
}

const CATEGORIES = [
    { id: 'MEAL', label: 'Dieta / Comida', color: 'bg-amber-500' },
    { id: 'TRAVEL', label: 'Desplazamiento / Viaje', color: 'bg-blue-500' },
    { id: 'SUPPLIES', label: 'Materiales / Suministros', color: 'bg-emerald-500' },
    { id: 'OTHER', label: 'Otros', color: 'bg-slate-500' },
];

import { useConfirm } from '../context/ConfirmContext';

export default function ExpenseManager({ employeeId, isAdmin = false }: { employeeId: string; isAdmin?: boolean }) {
    const confirmAction = useConfirm();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [ocrProcessing, setOcrProcessing] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [filter, setFilter] = useState('ALL');

    // Form states
    const [category, setCategory] = useState('MEAL');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [file, setFile] = useState<File | null>(null);

    useEffect(() => {
        fetchExpenses();
    }, [employeeId]);

    const fetchExpenses = async () => {
        try {
            const data = await api.get(`/expenses/employee/${employeeId}`);
            setExpenses(data);
        } catch (error) {
            toast.error('Error al cargar gastos');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);

        // Lanzar OCR automáticamente
        setOcrProcessing(true);
        const formData = new FormData();
        formData.append('receipt', selectedFile);

        try {
            const data = await api.post('/expenses/ocr', formData);
            if (data.suggestedAmount) {
                setAmount(data.suggestedAmount.toString());
                toast.info(`Importe detectado: ${data.suggestedAmount}€`, {
                    description: 'Revisa que sea correcto antes de guardar.'
                });
            }
            if (data.suggestedDate) {
                setDate(data.suggestedDate);
                toast.info(`Fecha detectada: ${data.suggestedDate}`);
            }
        } catch (error) {
            console.error('Error al procesar OCR:', error);
        } finally {
            setOcrProcessing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || isNaN(parseFloat(amount))) return toast.error('El importe no es válido');

        setSaving(true);
        const formData = new FormData();
        formData.append('employeeId', employeeId);
        formData.append('category', category);
        formData.append('amount', amount);
        formData.append('description', description);
        formData.append('date', date);
        formData.append('paymentMethod', paymentMethod);
        if (file) formData.append('receipt', file);

        try {
            await api.post('/expenses/upload', formData);
            toast.success('Gasto registrado correctamente');
            setShowForm(false);
            resetForm();
            fetchExpenses();
        } catch (error) {
            toast.error('Error al subir el gasto');
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => {
        setAmount('');
        setDescription('');
        setFile(null);
        setCategory('MEAL');
    };

    const handleUpdateStatus = async (id: string, status: string) => {
        try {
            await api.put(`/expenses/${id}/status`, { status });
            toast.success(`Estado actualizado a ${status}`);
            fetchExpenses();
        } catch (error) {
            toast.error('Error al actualizar estado');
        }
    };

    const handleDelete = async (id: string) => {
        const ok = await confirmAction({
            title: 'Eliminar Gasto',
            message: '¿Estás seguro de eliminar este gasto? Esta acción no se puede deshacer.',
            confirmText: 'Eliminar',
            type: 'danger'
        });

        if (!ok) return;
        try {
            await api.delete(`/expenses/${id}`);
            toast.success('Gasto eliminado');
            fetchExpenses();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const filteredExpenses = filter === 'ALL'
        ? expenses
        : expenses.filter(e => e.status === filter);

    const totalApproved = expenses
        .filter(e => e.status === 'APPROVED')
        .reduce((sum, e) => sum + e.amount, 0);

    const totalPending = expenses
        .filter(e => e.status === 'PENDING')
        .reduce((sum, e) => sum + e.amount, 0);

    if (loading) return <div className="p-10 text-center animate-pulse">Cargando gastos...</div>;

    return (
        <div className="space-y-6">
            {/* Header & Stats */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Receipt className="text-emerald-600" size={24} /> Gestión de Gastos y Dietas
                    </h3>
                    <div className="flex gap-4 mt-1">
                        <p className="text-sm text-slate-500">
                            Aprobados: <span className="font-bold text-emerald-600">{totalApproved.toFixed(2)}€</span>
                        </p>
                        <p className="text-sm text-slate-500">
                            Pendientes: <span className="font-bold text-amber-600">{totalPending.toFixed(2)}€</span>
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20"
                >
                    {showForm ? <X size={18} /> : <Plus size={18} />}
                    {showForm ? 'Cancelar' : 'Nuevo Gasto'}
                </button>
            </div>

            {/* Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl animate-in zoom-in-95 duration-200 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Fecha</label>
                            <input
                                type="date"
                                required
                                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Categoría</label>
                            <select
                                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                            >
                                {CATEGORIES.map(c => (
                                    <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Importe (€)</label>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                required
                                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Descripción</label>
                            <input
                                type="text"
                                placeholder="Ej: Comida cliente en Palma"
                                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Método de Pago</label>
                            <select
                                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                            >
                                <option value="CASH">Efectivo</option>
                                <option value="CARD">Tarjeta Empresa</option>
                                <option value="PERSONAL_CARD">Tarjeta Personal</option>
                                <option value="TRANSFER">Transferencia</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Recibo (Foto/PDF)</label>
                        <div className="flex items-center gap-4">
                            <label className="flex-1 flex items-center justify-center p-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:bg-slate-50 transition-all relative overflow-hidden">
                                {ocrProcessing && (
                                    <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 flex items-center justify-center z-10 backdrop-blur-sm">
                                        <Loader2 className="animate-spin text-emerald-500 mr-2" size={16} />
                                        <span className="text-xs font-bold text-emerald-600">Extrayendo datos...</span>
                                    </div>
                                )}
                                <Upload size={20} className="mr-2 text-slate-400" />
                                <span className="text-sm text-slate-500">{file ? file.name : 'Subir justificante/ticket'}</span>
                                <input type="file" className="hidden" onChange={handleFileUpload} />
                            </label>
                            {file && (
                                <button type="button" onClick={() => setFile(null)} className="p-2 text-rose-500">
                                    <X size={20} />
                                </button>
                            )}
                        </div>
                    </div>

                    <button
                        disabled={saving}
                        type="submit"
                        className="w-full bg-slate-900 dark:bg-emerald-600 text-white font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                        Confirmar y Subir Gasto
                    </button>
                </form>
            )}

            {/* Filters */}
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl w-fit">
                {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
                    <button
                        key={s}
                        onClick={() => setFilter(s)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === s
                            ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        {s === 'ALL' ? 'Todos' : s === 'PENDING' ? 'Pendientes' : s === 'APPROVED' ? 'Aprobados' : 'Rechazados'}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="space-y-4">
                {filteredExpenses.length > 0 ? (
                    filteredExpenses.map(expense => {
                        const cat = CATEGORIES.find(c => c.id === expense.category);
                        return (
                            <div key={expense.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm group hover:border-emerald-500 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl ${cat?.color || 'bg-slate-500'} bg-opacity-10 text-opacity-100`}>
                                        <DollarSign size={20} className={cat?.color.replace('bg-', 'text-')} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-slate-900 dark:text-white">{expense.amount.toFixed(2)}€</h4>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${expense.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                                                expense.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                                                    'bg-amber-100 text-amber-700'
                                                }`}>
                                                {expense.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                            <Calendar size={12} /> {format(new Date(expense.date), 'dd MMM yyyy', { locale: es })}
                                            <span className="mx-1">•</span>
                                            {cat?.label}
                                        </p>
                                        {expense.description && (
                                            <p className="text-xs text-slate-400 mt-1">{expense.description}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-2 md:pt-0">
                                    {expense.receiptUrl && (
                                        <a
                                            href={`${API_URL.replace(/\/+$/, '')}/expenses/${expense.id}/receipt`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                                            title="Ver Recibo"
                                        >
                                            <ExternalLink size={16} />
                                        </a>
                                    )}
                                    <button
                                        onClick={() => handleDelete(expense.id)}
                                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={16} />
                                    </button>

                                    {/* Admin Controls */}
                                    {isAdmin && expense.status === 'PENDING' && (
                                        <div className="flex gap-1 ml-2 pl-2 border-l border-slate-100 dark:border-slate-800">
                                            <button
                                                onClick={() => handleUpdateStatus(expense.id, 'APPROVED')}
                                                className="bg-emerald-500 text-white p-2 rounded-lg hover:bg-emerald-600 shadow-md shadow-emerald-500/20"
                                            >
                                                <CheckCircle2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleUpdateStatus(expense.id, 'REJECTED')}
                                                className="bg-rose-500 text-white p-2 rounded-lg hover:bg-rose-600 shadow-md shadow-rose-500/20"
                                            >
                                                <XCircle size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="py-12 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/20 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                        <Receipt className="text-slate-300 mb-2" size={32} />
                        <p className="text-slate-400 text-sm font-medium">No hay gastos registrados</p>
                    </div>
                )}
            </div>
        </div>
    );
}
