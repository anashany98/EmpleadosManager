import { useState, useEffect } from 'react';
import { Plus, Building2, Trash2, Save, X, MapPin, Pencil } from 'lucide-react';
import { api } from '../api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import { useConfirm } from '../context/ConfirmContext';

export default function Companies() {
    const confirmAction = useConfirm();
    const [companies, setCompanies] = useState<any[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newCompany, setNewCompany] = useState({
        name: '', cif: '', legalRep: '', address: '', postalCode: '',
        city: '', province: '', country: '', email: '', phone: '',
        officeLatitude: '', officeLongitude: '', allowedRadius: 100
    });

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

    const resetForm = () => {
        setNewCompany({
            name: '', cif: '', legalRep: '', address: '', postalCode: '',
            city: '', province: '', country: '', email: '', phone: '',
            officeLatitude: '', officeLongitude: '', allowedRadius: 100
        });
        setEditingId(null);
        setIsAdding(false);
    };

    const handleEdit = (company: any) => {
        setNewCompany({
            ...company,
            officeLatitude: company.officeLatitude || '',
            officeLongitude: company.officeLongitude || '',
            allowedRadius: company.allowedRadius || 100
        });
        setEditingId(company.id);
        setIsAdding(true);
    };

    const handleSave = async () => {
        if (!newCompany.name || !newCompany.cif) return toast.error('Nombre y CIF son obligatorios');
        try {
            if (editingId) {
                await api.put(`/companies/${editingId}`, newCompany);
                toast.success('Empresa actualizada correctamente');
            } else {
                await api.post('/companies', newCompany);
                toast.success('Empresa creada correctamente');
            }
            resetForm();
            fetchCompanies();
        } catch (err) {
            toast.error(editingId ? 'Error al actualizar' : 'Error al crear empresa');
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
                    <p className="text-slate-500 dark:text-slate-400">Gestiona las entidades legales y sus ubicaciones</p>
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
                            className="bg-white dark:bg-slate-900 p-6 rounded-2xl border-2 border-dashed border-blue-500 col-span-full shadow-xl"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <Building2 size={24} className="text-blue-500" />
                                    {editingId ? 'Editar Empresa' : 'Nueva Empresa'}
                                </h3>
                                <button onClick={resetForm} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {/* Datos Identificativos */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800 pb-2">Identificación</h4>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Nombre Fiscal <span className="text-red-500">*</span></label>
                                        <input
                                            placeholder="Ej: Mi Empresa S.L."
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            value={newCompany.name}
                                            onChange={e => setNewCompany({ ...newCompany, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1.5 block">CIF <span className="text-red-500">*</span></label>
                                        <input
                                            placeholder="Ej: B12345678"
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            value={newCompany.cif}
                                            onChange={e => setNewCompany({ ...newCompany, cif: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Apoderado / Representante</label>
                                        <input
                                            placeholder="Nombre completo"
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            value={newCompany.legalRep}
                                            onChange={e => setNewCompany({ ...newCompany, legalRep: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Dirección y Contacto */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800 pb-2">Ubicación y Contacto</h4>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Dirección</label>
                                        <input
                                            placeholder="Calle, Número, Piso..."
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            value={newCompany.address}
                                            onChange={e => setNewCompany({ ...newCompany, address: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 mb-1.5 block">CP</label>
                                            <input
                                                placeholder="07000"
                                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                value={newCompany.postalCode}
                                                onChange={e => setNewCompany({ ...newCompany, postalCode: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 mb-1.5 block">Ciudad</label>
                                            <input
                                                placeholder="Palma"
                                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                value={newCompany.city}
                                                onChange={e => setNewCompany({ ...newCompany, city: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Email</label>
                                        <input
                                            type="email"
                                            placeholder="contacto@empresa.com"
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            value={newCompany.email}
                                            onChange={e => setNewCompany({ ...newCompany, email: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Geofencing */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-amber-500 uppercase border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
                                        <MapPin size={14} /> Geofencing
                                    </h4>
                                    <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/20 space-y-3">
                                        <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 leading-relaxed">
                                            Configura la ubicación de la oficina para validar los fichajes de los empleados.
                                        </p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Latitud</label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    placeholder="39.57..."
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-sm font-mono"
                                                    value={newCompany.officeLatitude}
                                                    onChange={e => setNewCompany({ ...newCompany, officeLatitude: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Longitud</label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    placeholder="2.65..."
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-sm font-mono"
                                                    value={newCompany.officeLongitude}
                                                    onChange={e => setNewCompany({ ...newCompany, officeLongitude: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Radio Permitido (metros)</label>
                                            <input
                                                type="number"
                                                placeholder="100"
                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-sm font-bold text-amber-600"
                                                value={newCompany.allowedRadius}
                                                onChange={e => setNewCompany({ ...newCompany, allowedRadius: parseInt(e.target.value) || 100 })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                                <button onClick={resetForm} className="px-6 py-2.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium">Cancelar</button>
                                <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-xl flex items-center gap-2 transition-colors font-bold shadow-lg shadow-blue-500/20">
                                    <Save size={18} /> {editingId ? 'Actualizar Empresa' : 'Guardar Empresa'}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {companies.map((company, index) => (
                        <motion.div
                            key={company.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
                            onClick={() => handleEdit(company)}
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleEdit(company); }}
                                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                    title="Editar"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(company.id); }}
                                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                    title="Eliminar"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform duration-300">
                                    <Building2 size={24} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{company.name}</h3>
                                    <p className="text-sm text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 inline-block px-2 py-0.5 rounded text-xs">{company.cif}</p>

                                    {(company.officeLatitude && company.officeLongitude) && (
                                        <div className="flex items-center gap-1.5 mt-3 text-xs text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg w-fit">
                                            <MapPin size={12} />
                                            <span>Geofencing Activo ({company.allowedRadius}m)</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}
