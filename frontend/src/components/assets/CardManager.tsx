
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { toast } from 'sonner';
import { CreditCard, Plus, Trash2, PenSquare, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Card {
    id: string;
    alias: string;
    panLast4: string;
    provider: string; // VISA, MASTERCARD, SOLRED, CEPSA
    type: 'CREDIT' | 'DEBIT' | 'FUEL' | 'TOLL';
    status: 'ACTIVE' | 'BLOCKED' | 'CANCELLED';
    limit?: number;
    expiryDate?: string;
    employee?: { id: string; firstName: string; lastName: string };
    employeeId?: string;
}

export function CardManager() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCard, setEditingCard] = useState<Card | null>(null);
    const queryClient = useQueryClient();

    const { data: cards = [], isLoading } = useQuery<Card[]>({
        queryKey: ['cards'],
        queryFn: async () => {
            const res = await api.get('/cards');
            return res.data?.data || res.data || [];
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => api.delete(`/cards/${id}`),
        onSuccess: () => {
            toast.success('Tarjeta eliminada');
            queryClient.invalidateQueries({ queryKey: ['cards'] });
        },
        onError: () => toast.error('Error al eliminar tarjeta')
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Tarjetas Corporativas y Combustible</h2>
                <button
                    onClick={() => { setEditingCard(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                >
                    <Plus className="w-4 h-4" />
                    Añadir Tarjeta
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cards.map((card) => (
                        <div key={card.id} className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-xl transform hover:-translate-y-1 transition-all relative group">
                            <div className="flex justify-between items-start mb-8">
                                <CreditCard className="w-8 h-8 opacity-50" />
                                <div className="text-right">
                                    <p className="font-bold text-lg">{card.provider}</p>
                                    <span className="text-xs opacity-70 bg-white/10 px-2 py-0.5 rounded">{card.type}</span>
                                </div>
                            </div>

                            <div className="mb-6">
                                <p className="text-2xl font-mono tracking-widest">•••• •••• •••• {card.panLast4}</p>
                                <p className="text-sm opacity-60 mt-1">{card.alias}</p>
                            </div>

                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] uppercase opacity-60 tracking-wider">Titular</p>
                                    <p className="font-bold text-sm">{card.employee ? `${card.employee.firstName} ${card.employee.lastName}` : 'NO ASIGNADO'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase opacity-60 tracking-wider">Caduca</p>
                                    <p className="font-bold text-sm">{card.expiryDate ? new Date(card.expiryDate).toLocaleDateString(undefined, { month: '2-digit', year: '2-digit' }) : '--/--'}</p>
                                </div>
                            </div>

                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                <button
                                    onClick={() => { setEditingCard(card); setIsModalOpen(true); }}
                                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm"
                                >
                                    <PenSquare className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirm('¿Eliminar tarjeta?')) deleteMutation.mutate(card.id);
                                    }}
                                    className="p-2 bg-white/20 hover:bg-red-500/50 rounded-lg backdrop-blur-sm"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <AnimatePresence>
                {isModalOpen && (
                    <CardModal
                        card={editingCard}
                        onClose={() => setIsModalOpen(false)}
                        onSuccess={() => {
                            setIsModalOpen(false);
                            queryClient.invalidateQueries({ queryKey: ['cards'] });
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

function CardModal({ card, onClose, onSuccess }: { card: Card | null, onClose: () => void, onSuccess: () => void }) {
    const isEdit = !!card;
    const [formData, setFormData] = useState<Partial<Card>>(card || {
        alias: '', panLast4: '', provider: 'VISA', type: 'CREDIT', status: 'ACTIVE', limit: 0
    });

    const mutation = useMutation({
        mutationFn: async (data: any) => {
            if (isEdit) return api.put(`/cards/${card.id}`, data);
            return api.post('/cards', data);
        },
        onSuccess: () => {
            toast.success(`Tarjeta ${isEdit ? 'actualizada' : 'creada'}`);
            onSuccess();
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Error al guardar')
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: async () => {
            const res = await api.get('/employees');
            return res.data?.data || res.data || [];
        }
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-8 shadow-2xl"
            >
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6">
                    {isEdit ? 'Editar Tarjeta' : 'Nueva Tarjeta'}
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Alias (Identificador)</label>
                        <input
                            type="text"
                            value={formData.alias}
                            onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl"
                            placeholder="Ej: Visa Repsol Dept. Ventas"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Proveedor</label>
                            <select
                                value={formData.provider}
                                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl"
                            >
                                <option value="VISA">Visa</option>
                                <option value="MASTERCARD">Mastercard</option>
                                <option value="AMEX">Amex</option>
                                <option value="SOLRED">Solred</option>
                                <option value="CEPSA">Cepsa</option>
                                <option value="STAR_RESSA">Star Ressa</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Tipo</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                                className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl"
                            >
                                <option value="CREDIT">Crédito</option>
                                <option value="DEBIT">Debito</option>
                                <option value="FUEL">Gasolina</option>
                                <option value="TOLL">Peaje (Via-T)</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Últimos 4 dígitos</label>
                            <input
                                type="text"
                                maxLength={4}
                                value={formData.panLast4}
                                onChange={(e) => setFormData({ ...formData, panLast4: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl font-mono text-center tracking-widest"
                                placeholder="8899"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Límite (€)</label>
                            <input
                                type="number"
                                value={formData.limit}
                                onChange={(e) => setFormData({ ...formData, limit: Number(e.target.value) })}
                                className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Fecha Caducidad</label>
                        <input
                            type="date"
                            value={formData.expiryDate ? new Date(formData.expiryDate).toISOString().split('T')[0] : ''}
                            onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Empleado Asignado</label>
                        <select
                            value={formData.employeeId || ''}
                            onChange={(e) => setFormData({ ...formData, employeeId: e.target.value || undefined })}
                            className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl"
                        >
                            <option value="">-- Sin asignar --</option>
                            {employees.map((emp: any) => (
                                <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex gap-4 mt-8">
                    <button onClick={onClose} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl hover:bg-slate-200">
                        Cancelar
                    </button>
                    <button onClick={() => mutation.mutate(formData)} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200">
                        {mutation.isPending ? 'Guardando...' : 'Guardar Tarjeta'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
