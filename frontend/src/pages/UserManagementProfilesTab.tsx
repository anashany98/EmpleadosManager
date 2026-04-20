import { useState } from 'react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { Search, Edit, Trash2, Plus, Loader2 } from 'lucide-react';
import type { PermissionMap, PermissionModule, PermissionLevel } from '@shared/authz';
import { PERMISSION_MODULES } from '@shared/authz';
import { motion, AnimatePresence } from 'framer-motion';
import { useConfirm } from '../context/ConfirmContext';

const MODULE_LABELS: Record<PermissionModule, string> = {
    dashboard: 'Dashboard',
    employees: 'Empleados',
    companies: 'Empresas',
    calendar: 'Calendario',
    vacations: 'Vacaciones',
    timesheet: 'Fichaje',
    expenses: 'Gastos',
    documents: 'Documentos',
    payroll: 'Nominas',
    assets: 'Activos',
    projects: 'Proyectos',
    reports: 'Reportes',
    analytics: 'Analytics',
    performance: 'Rendimiento',
    audit: 'Auditoria',
    inbox: 'Inbox',
    users: 'Usuarios',
    settings: 'Configuracion',
    kiosk: 'Kiosco',
    cards: 'Tarjetas',
    fleet: 'Flota',
    notifications: 'Notificaciones',
    onboarding: 'Onboarding',
    offboarding: 'Offboarding'
};

interface PermissionProfile {
    id: string;
    name: string;
    permissions: PermissionMap;
}

interface ProfilesTabProps {
    profiles: PermissionProfile[];
    onRefresh: () => void;
}

export default function UserManagementProfilesTab({ profiles, onRefresh }: ProfilesTabProps) {
    const confirmAction = useConfirm();
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<PermissionProfile | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [profileName, setProfileName] = useState('');
    const [profilePermissions, setProfilePermissions] = useState<PermissionMap>({});

    const filteredProfiles = profiles.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleOpenModal = (profile: PermissionProfile | null = null) => {
        if (profile) {
            setEditingProfile(profile);
            setProfileName(profile.name);
            setProfilePermissions(profile.permissions || {});
        } else {
            setEditingProfile(null);
            setProfileName('');
            setProfilePermissions({});
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = { name: profileName, permissions: profilePermissions };

            if (editingProfile) {
                await api.put(`/permission-profiles/${editingProfile.id}`, payload);
                toast.success('Perfil actualizado');
            } else {
                await api.post('/permission-profiles', payload);
                toast.success('Perfil creado');
            }
            setIsModalOpen(false);
            onRefresh();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Error al guardar');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (profile: PermissionProfile) => {
        const confirmed = await confirmAction({
            title: 'Eliminar perfil',
            message: `¿Estás seguro de eliminar el perfil "${profile.name}"?`
        });
        if (!confirmed) return;
        try {
            await api.delete(`/permission-profiles/${profile.id}`);
            toast.success('Perfil eliminado');
            onRefresh();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Error al eliminar');
        }
    };

    const togglePermission = (module: PermissionModule, level: PermissionLevel) => {
        setProfilePermissions(prev => ({
            ...prev,
            [module]: level
        }));
    };

    return (
        <>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                <Search className="text-slate-400" size={18} />
                <input
                    type="text"
                    placeholder="Buscar perfil..."
                    className="bg-transparent border-none outline-none text-slate-700 dark:text-slate-200 w-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                        <tr>
                            <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Nombre</th>
                            <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Módulos</th>
                            <th className="text-right p-4 text-xs font-bold text-slate-500 uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredProfiles.map(profile => (
                            <tr key={profile.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                <td className="p-4">
                                    <div className="font-medium text-slate-900 dark:text-white">{profile.name}</div>
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-wrap gap-1">
                                        {Object.entries(profile.permissions || {}).map(([mod, level]) => (
                                            level !== 'none' && (
                                                <span key={mod} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs text-slate-600 dark:text-slate-400">
                                                    {MODULE_LABELS[mod as PermissionModule]}
                                                </span>
                                            )
                                        ))}
                                    </div>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <button
                                            onClick={() => handleOpenModal(profile)}
                                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                                        >
                                            <Edit size={16} className="text-slate-500" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(profile)}
                                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                        >
                                            <Trash2 size={16} className="text-red-500" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                        >
                            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                    {editingProfile ? 'Editar perfil' : 'Nuevo perfil'}
                                </h2>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                                    ×
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre del perfil</label>
                                    <input
                                        type="text"
                                        required
                                        value={profileName}
                                        onChange={(e) => setProfileName(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                        placeholder="ej: Gerente, Empleado Básico..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Permisos</label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                                        {PERMISSION_MODULES.filter(m => m !== 'dashboard').map(module => (
                                            <label key={module} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                                                <input
                                                    type="checkbox"
                                                    checked={profilePermissions[module] === 'write'}
                                                    onChange={(e) => togglePermission(module, e.target.checked ? 'write' : 'none')}
                                                    className="rounded"
                                                />
                                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                                    {MODULE_LABELS[module]}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-4 py-2 rounded-xl bg-blue-600 text-white font-medium disabled:opacity-50"
                                    >
                                        {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Guardar'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}