import React, { useState, useEffect } from 'react';
import { Plus, Building2, Trash2, Save, X, Search, Loader2 } from 'lucide-react';
import { api } from '../api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function Companies() {
    const [companies, setCompanies] = useState<any[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newCompany, setNewCompany] = useState({ name: '', cif: '' });

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        try {
            const data = await api.get('/companies');
            setCompanies(data);
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
        // Here we could use a custom Modal, but for now let's keep it simple or use toast.promise
        if (!confirm('¿Seguro que quieres eliminar esta empresa?')) return;
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
                            className="bg-white dark:bg-slate-900 p-6 rounded-2xl border-2 border-dashed border-blue-500"
                        >
                            <h3 className="font-bold mb-4 text-slate-800 dark:text-white">Añadir Empresa</h3>
                            <div className="space-y-4">
                                <input
                                    placeholder="Nombre de la empresa"
                                    className="w-full px-4 py-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700"
                                    value={newCompany.name}
                                    onChange={e => setNewCompany({ ...newCompany, name: e.target.value })}
                                />
                                <input
                                    placeholder="CIF"
                                    className="w-full px-4 py-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700"
                                    value={newCompany.cif}
                                    onChange={e => setNewCompany({ ...newCompany, cif: e.target.value })}
                                />
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setIsAdding(false)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
                                    <button onClick={handleCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"><Save size={18} /> Guardar</button>
                                </div>
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
