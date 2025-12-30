
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { ArrowLeft, FileText, Plus, Trash2, Save, Calculator, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

interface PayrollItem {
    id?: string;
    concept: string;
    amount: number;
    type: 'EARNING' | 'DEDUCTION';
}

interface PayrollRow {
    id: string;
    rawEmployeeName: string;
    neto: number;
    bruto: number;
    items?: PayrollItem[];
}

export default function PayrollBatchDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Selecting a row for breakdown editing
    const [selectedRow, setSelectedRow] = useState<PayrollRow | null>(null);

    // Fetch Rows
    const { data: batchData, isLoading } = useQuery({
        queryKey: ['payroll-rows', id],
        queryFn: async () => {
            const res = await api.get(`/payroll/${id}/rows?limit=1000`); // Fetch all for now
            return res.data;
        },
        enabled: !!id
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                    <ArrowLeft size={20} className="text-slate-500" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Detalle de Nómina</h1>
                    <p className="text-slate-500 dark:text-slate-400">Lote ID: <span className="font-mono text-xs">{id}</span></p>
                </div>
            </div>

            {isLoading ? (
                <div className="p-10 text-center text-slate-500">Cargando nóminas...</div>
            ) : (
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-medium">
                            <tr>
                                <th className="p-4">Empleado</th>
                                <th className="p-4 text-right">Bruto</th>
                                <th className="p-4 text-right">Neto</th>
                                <th className="p-4 text-center">Desglose</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {batchData?.rows?.map((row: PayrollRow) => (
                                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="p-4 font-medium text-slate-900 dark:text-white">{row.rawEmployeeName}</td>
                                    <td className="p-4 text-right tabular-nums">{Number(row.bruto).toFixed(2)} €</td>
                                    <td className="p-4 text-right tabular-nums font-bold text-slate-900 dark:text-white">{Number(row.neto).toFixed(2)} €</td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => setSelectedRow(row)}
                                            className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center gap-2 mx-auto"
                                        >
                                            <Calculator size={14} />
                                            {row.items && row.items.length > 0 ? 'Ver Desglose' : 'Introducir'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Breakdown Modal */}
            {selectedRow && (
                <BreakdownEditor
                    row={selectedRow}
                    onClose={() => setSelectedRow(null)}
                    onSaved={() => queryClient.invalidateQueries({ queryKey: ['payroll-rows', id] })}
                />
            )}
        </div>
    );
}

function BreakdownEditor({ row, onClose, onSaved }: { row: PayrollRow, onClose: () => void, onSaved: () => void }) {
    const [items, setItems] = useState<PayrollItem[]>([]);
    const [loading, setLoading] = useState(true);

    // New Item State
    const [newItem, setNewItem] = useState({ concept: '', amount: '', type: 'EARNING' });

    // Load Items directly
    const loadItems = async () => {
        try {
            const res = await api.get(`/payroll/row/${row.id}/breakdown`);
            setItems(res.data || []);
        } catch (e) {
            toast.error('Error cargando desglose');
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        loadItems();
    }, [row.id]);

    const handleAddItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItem.concept || !newItem.amount) return;

        setItems([...items, {
            concept: newItem.concept,
            amount: parseFloat(newItem.amount),
            type: newItem.type as any
        }]);
        setNewItem({ concept: '', amount: '', type: 'EARNING' });
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const handleSave = async () => {
        try {
            await api.post(`/payroll/row/${row.id}/breakdown`, { items });
            toast.success('Desglose guardado correctamente');
            onSaved();
            onClose();
        } catch (error) {
            toast.error('Error al guardar');
        }
    };

    // Calculate totals based on items
    const totalEarnings = items.filter(i => i.type === 'EARNING').reduce((sum, i) => sum + Number(i.amount), 0);
    const totalDeductions = items.filter(i => i.type === 'DEDUCTION').reduce((sum, i) => sum + Number(i.amount), 0);
    const calculatedNet = totalEarnings - totalDeductions;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Desglose de Nómina</h2>
                        <p className="text-sm text-slate-500">{row.rawEmployeeName}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>

                <div className="flex-1 overflow-auto p-6 space-y-6">
                    {/* Add Form */}
                    <form onSubmit={handleAddItem} className="flex gap-2 items-end bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Concepto</label>
                            <input
                                type="text"
                                placeholder="Ej: Salario Base, Bonus..."
                                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                                value={newItem.concept}
                                onChange={e => setNewItem({ ...newItem, concept: e.target.value })}
                            />
                        </div>
                        <div className="w-32">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Tipo</label>
                            <select
                                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                                value={newItem.type}
                                onChange={e => setNewItem({ ...newItem, type: e.target.value })}
                            >
                                <option value="EARNING">Devengo (+)</option>
                                <option value="DEDUCTION">Deducción (-)</option>
                            </select>
                        </div>
                        <div className="w-32">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Importe</label>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                                value={newItem.amount}
                                onChange={e => setNewItem({ ...newItem, amount: e.target.value })}
                            />
                        </div>
                        <button type="submit" className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mb-[1px]">
                            <Plus size={20} />
                        </button>
                    </form>

                    {/* Items List */}
                    {loading ? (
                        <div className="text-center py-8 text-slate-400"><Calculator className="animate-spin mx-auto mb-2" /> Cargando conceptos...</div>
                    ) : (
                        <div className="space-y-1">
                            {items.length === 0 && (
                                <div className="text-center py-8 text-slate-400 border border-dashed rounded-xl border-slate-200 dark:border-slate-700">
                                    No hay conceptos añadidos.
                                </div>
                            )}
                            {items.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 hover:shadow-sm transition-shadow">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-full ${item.type === 'EARNING' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                            <DollarSign size={16} />
                                        </div>
                                        <span className="font-medium text-slate-700 dark:text-slate-200">{item.concept}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`font-mono font-bold ${item.type === 'EARNING' ? 'text-green-600' : 'text-red-600'}`}>
                                            {item.type === 'EARNING' ? '+' : '-'}{Number(item.amount).toFixed(2)} €
                                        </span>
                                        <button onClick={() => handleRemoveItem(idx)} className="text-slate-400 hover:text-red-500 transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Summary */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-2 border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Total Devengado (Bruto calculado)</span>
                            <span className="font-bold text-green-600">{totalEarnings.toFixed(2)} €</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Total Deducciones</span>
                            <span className="font-bold text-red-600">{totalDeductions.toFixed(2)} €</span>
                        </div>
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between font-bold text-lg">
                            <span className="text-slate-900 dark:text-white">Liquido a Percibir</span>
                            <span className="text-blue-600">{calculatedNet.toFixed(2)} €</span>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-900">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-md flex items-center gap-2"
                    >
                        <Save size={16} /> Guardar Desglose
                    </button>
                </div>
            </div>
        </div>
    );
}
