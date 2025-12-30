import { useState, useEffect } from 'react';
import { Plus, Building2, Trash2, Save, X } from 'lucide-react';
import { api } from '../api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import { useConfirm } from '../context/ConfirmContext';

export default function Companies() {
    const confirmAction = useConfirm();
    const [companies, setCompanies] = useState<any[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newCompany, setNewCompany] = useState({ name: '', cif: '' });

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        try {
            const res = await api.get('/companies');
            setCompanies(res.data || res || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreate = async () => {
        if (!newCompany.name || !newCompany.cif) return toast.error('Nombre y CIF son obligatorios');
        try {
            await api.post('/companies', newCompany);
            setNewCompany({ name: '', cif: '' });
            setIsAdding(false);
            toast.success('Empresa creada correctamente');
            fetchCompanies();
        } catch (err) {
            toast.error('Error al crear empresa');
        }
    };

    const handleDelete = async (id: string) => {
        const ok = await confirmAction({
            title: 'Eliminar Empresa',
            message: '¿Estás seguro de que quieres eliminar esta empresa? Esta acción no se puede deshacer.',
            confirmText: 'Eliminar',
            type: 'danger'
        });

        if (!ok) return;

        try {
            await api.delete(`/companies/${id}`);
            toast.success('Empresa eliminada');
            fetchCompanies();
        } catch (err) {
            toast.error('Error al eliminar. Asegúrate de que no tenga empleados asociados.');
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Empresas</h1>
                    <p className="text-slate-500 dark:text-slate-400">Gestiona las entidades legales disponibles</p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium shadow-lg flex items-center gap-2 transition-all"
                >
                    <Plus size={20} /> Nueva Empresa
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                    {isAdding && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white dark:bg-slate-900 p-6 rounded-2xl border-2 border-dashed border-blue-500 col-span-full"
                        >
                            <h3 className="font-bold mb-4 text-slate-800 dark:text-white flex items-center gap-2">
                                <Building2 size={20} className="text-blue-500" />
                                Nueva Empresa
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {/* Datos Identificativos */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800 pb-1">Identificación</h4>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">Nombre Fiscal</label>
                                        <input
                                            placeholder="Ej: Mi Empresa S.L."
                                            className="w-full px-4 py-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 text-sm"
                                            value={newCompany.name}
                                            onChange={e => setNewCompany({ ...newCompany, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">CIF</label>
                                        <input
                                            placeholder="Ej: B12345678"
                                            className="w-full px-4 py-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 text-sm"
                                            value={newCompany.cif}
                                            onChange={e => setNewCompany({ ...newCompany, cif: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">Apoderado / Representante</label>
                                        <input
                                            placeholder="Nombre completo"
                                            className="w-full px-4 py-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 text-sm"
                                            value={(newCompany as any).legalRep || ''}
                                            onChange={e => setNewCompany({ ...newCompany, legalRep: e.target.value } as any)}
                                        />
                                    </div>
                                </div>

                                {/* Dirección */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800 pb-1">Dirección</h4>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">Dirección</label>
                                        <input
                                            placeholder="Calle, Número, Piso..."
                                            className="w-full px-4 py-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 text-sm"
                                            value={(newCompany as any).address || ''}
                                            onChange={e => setNewCompany({ ...newCompany, address: e.target.value } as any)}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 mb-1 block">Código Postal</label>
                                            <input
                                                placeholder="07000"
                                                className="w-full px-4 py-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 text-sm"
                                                value={(newCompany as any).postalCode || ''}
                                                onChange={e => setNewCompany({ ...newCompany, postalCode: e.target.value } as any)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 mb-1 block">Ciudad</label>
                                            <input
                                                placeholder="Palma"
                                                className="w-full px-4 py-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 text-sm"
                                                value={(newCompany as any).city || ''}
                                                onChange={e => setNewCompany({ ...newCompany, city: e.target.value } as any)}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 mb-1 block">Provincia</label>
                                            <input
                                                placeholder="Baleares"
                                                className="w-full px-4 py-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 text-sm"
                                                value={(newCompany as any).province || ''}
                                                onChange={e => setNewCompany({ ...newCompany, province: e.target.value } as any)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 mb-1 block">País</label>
                                            <input
                                                placeholder="España"
                                                className="w-full px-4 py-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 text-sm"
                                                value={(newCompany as any).country || ''}
                                                onChange={e => setNewCompany({ ...newCompany, country: e.target.value } as any)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Contacto */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800 pb-1">Contacto</h4>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
                                        <input
                                            type="email"
                                            placeholder="contacto@empresa.com"
                                            className="w-full px-4 py-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 text-sm"
                                            value={(newCompany as any).email || ''}
                                            onChange={e => setNewCompany({ ...newCompany, email: e.target.value } as any)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">Teléfono</label>
                                        <input
                                            type="tel"
                                            placeholder="+34 600 000 000"
                                            className="w-full px-4 py-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 text-sm"
                                            value={(newCompany as any).phone || ''}
                                            onChange={e => setNewCompany({ ...newCompany, phone: e.target.value } as any)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">Cancelar</button>
                                <button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-sm"><Save size={18} /> Guardar Empresa</button>
                            </div>
                        </motion.div>
                    )}

                    {companies.map((company, index) => (
                        <motion.div
                            key={company.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow group"
                        >
                            <div className="flex justify-between items-start">
                                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                    <Building2 size={24} />
                                </div>
                                <button
                                    onClick={() => handleDelete(company.id)}
                                    className="text-slate-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                            <h3 className="text-lg font-bold mt-4 text-slate-900 dark:text-white">{company.name}</h3>
                            <p className="text-sm text-slate-500 font-mono mt-1">{company.cif}</p>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}
