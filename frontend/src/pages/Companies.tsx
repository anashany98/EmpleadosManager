import { useCallback, useState, useEffect } from 'react';
import { Plus, Building2, Trash2, Save, X, MapPin, Pencil, AlertTriangle, RefreshCw } from 'lucide-react';
import { api, getErrorMessage } from '../api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

import { useConfirm } from '../context/ConfirmContext';

interface Company {
    id: string;
    name: string;
    cif: string;
    legalRep?: string | null;
    address?: string | null;
    postalCode?: string | null;
    city?: string | null;
    province?: string | null;
    country?: string | null;
    email?: string | null;
    phone?: string | null;
    officeLatitude?: number | null;
    officeLongitude?: number | null;
    allowedRadius?: number | null;
}

interface CompanyForm {
    name: string;
    cif: string;
    legalRep: string;
    address: string;
    postalCode: string;
    city: string;
    province: string;
    country: string;
    email: string;
    phone: string;
    officeLatitude: string;
    officeLongitude: string;
    allowedRadius: number;
}

const emptyCompanyForm = (): CompanyForm => ({
    name: '', cif: '', legalRep: '', address: '', postalCode: '',
    city: '', province: '', country: '', email: '', phone: '',
    officeLatitude: '', officeLongitude: '', allowedRadius: 100
});

export default function Companies() {
    const { user } = useAuth();
    const isGlobalAdmin = user?.role === 'admin' && !user?.companyId;
    const confirmAction = useConfirm();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newCompany, setNewCompany] = useState<CompanyForm>(emptyCompanyForm);

    const fetchCompanies = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await api.get<{ data?: Company[] }>('/companies');
            setCompanies(res.data || []);
        } catch (err) {
            setLoadError(getErrorMessage(err, 'No se pudieron cargar las empresas'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCompanies();
    }, [fetchCompanies]);

    const resetForm = () => {
        setNewCompany(emptyCompanyForm());
        setEditingId(null);
        setIsAdding(false);
    };

    const handleEdit = (company: Company) => {
        setNewCompany({
            name: company.name,
            cif: company.cif,
            legalRep: company.legalRep ?? '',
            address: company.address ?? '',
            postalCode: company.postalCode ?? '',
            city: company.city ?? '',
            province: company.province ?? '',
            country: company.country ?? '',
            email: company.email ?? '',
            phone: company.phone ?? '',
            officeLatitude: company.officeLatitude?.toString() ?? '',
            officeLongitude: company.officeLongitude?.toString() ?? '',
            allowedRadius: company.allowedRadius ?? 100,
        });
        setEditingId(company.id);
        setIsAdding(true);
    };

    const handleSave = async () => {
        const name = newCompany.name.trim();
        const cif = newCompany.cif.trim().toUpperCase();
        if (name.length < 2 || cif.length < 3) return toast.error('Revisa el nombre fiscal y el CIF/NIF');
        if (newCompany.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newCompany.email)) {
            return toast.error('El correo electrónico no es válido');
        }

        const latitude = newCompany.officeLatitude === '' ? null : Number(newCompany.officeLatitude);
        const longitude = newCompany.officeLongitude === '' ? null : Number(newCompany.officeLongitude);
        if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
            return toast.error('La latitud debe estar entre -90 y 90');
        }
        if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
            return toast.error('La longitud debe estar entre -180 y 180');
        }

        const payload = {
            ...newCompany,
            name,
            cif,
            officeLatitude: latitude,
            officeLongitude: longitude,
        };

        setSaving(true);
        try {
            if (editingId) {
                await api.put(`/companies/${editingId}`, payload);
                toast.success('Empresa actualizada correctamente');
            } else {
                await api.post('/companies', payload);
                toast.success('Empresa creada correctamente');
            }
            resetForm();
            await fetchCompanies();
        } catch (err) {
            toast.error(getErrorMessage(err, editingId ? 'Error al actualizar' : 'Error al crear empresa'));
        } finally {
            setSaving(false);
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
            toast.error(getErrorMessage(err, 'No se pudo eliminar la empresa'));
        }
    };

    return (
    <div className="space-y-4 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white">Empresas</h1>
                    <p className="text-slate-500 dark:text-slate-400">Gestiona las entidades legales y sus ubicaciones</p>
                </div>
                {isGlobalAdmin && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium shadow-lg flex items-center gap-2 transition-all w-full sm:w-auto justify-center"
                    >
                        <Plus size={20} /> <span className="hidden sm:inline">Nueva Empresa</span><span className="sm:hidden">Nueva</span>
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                    {loading && !isAdding && (
                        <div className="col-span-full flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                            <RefreshCw className="animate-spin" size={18} /> Cargando empresas…
                        </div>
                    )}
                    {loadError && !isAdding && (
                        <div className="col-span-full rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/60 dark:bg-red-950/20">
                            <AlertTriangle className="mx-auto text-red-600" size={24} />
                            <p className="mt-2 text-sm font-semibold text-red-800 dark:text-red-200">{loadError}</p>
                            <button type="button" onClick={fetchCompanies} className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700">
                                Reintentar
                            </button>
                        </div>
                    )}
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
                                <button disabled={saving} onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60 text-white px-8 py-2.5 rounded-xl flex items-center gap-2 transition-colors font-bold shadow-lg shadow-blue-500/20">
                                    {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />} {saving ? 'Guardando…' : editingId ? 'Actualizar Empresa' : 'Guardar Empresa'}
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
                                {isGlobalAdmin && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(company.id); }}
                                        className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
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
