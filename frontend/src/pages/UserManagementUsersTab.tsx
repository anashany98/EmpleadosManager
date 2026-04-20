import { useState } from 'react';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
    UserPlus,
    Search,
    Mail,
    Key,
    Edit,
    Trash2,
    Plus,
    Loader2,
    Lock,
    Eye,
    Ban
} from 'lucide-react';
import type { Role } from '@shared/authz';
import { useConfirm } from '../context/ConfirmContext';
import type { PermissionMap } from '@shared/authz';
import { PERMISSION_MODULES } from '@shared/authz';
import type { PermissionLevel, PermissionModule, PermissionMap } from '@shared/authz';

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
import { motion, AnimatePresence } from 'framer-motion';

interface User {
    id: string;
    email: string;
    role: Role;
    permissions: PermissionMap;
    createdAt: string;
}

interface UserFormData {
    email: string;
    password: string;
    role: Role;
    permissions: PermissionMap;
}

const ROLE_OPTIONS = [
    { value: 'admin', label: 'Administrador' },
    { value: 'manager', label: 'Gestor' },
    { value: 'employee', label: 'Empleado' }
];

const ROLE_BADGE_STYLES: Record<Role, string> = {
    admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    manager: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    employee: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
};

interface UsersTabProps {
    users: User[];
    profiles: { id: string; name: string; permissions: PermissionMap }[];
    onRefresh: () => void;
}

export default function UserManagementUsersTab({ users, profiles, onRefresh }: UsersTabProps) {
    const confirmAction = useConfirm();
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<Role>('employee');
    const [userPermissions, setUserPermissions] = useState<PermissionMap>({});

    const filteredUsers = users.filter(u => 
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleOpenModal = (user: User | null = null) => {
        if (user) {
            setEditingUser(user);
            setEmail(user.email);
            setPassword('');
            setRole(user.role);
            setUserPermissions(user.permissions || {});
        } else {
            setEditingUser(null);
            setEmail('');
            setPassword('');
            setRole('employee');
            setUserPermissions({});
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload: UserFormData = { email, role, permissions: userPermissions };
            if (password) (payload as any).password = password;

            if (editingUser) {
                await api.put(`/users/${editingUser.id}`, payload);
                toast.success('Usuario actualizado');
            } else {
                await api.post('/users', payload);
                toast.success('Usuario creado');
            }
            setIsModalOpen(false);
            onRefresh();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Error al guardar');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (user: User) => {
        const confirmed = await confirmAction({
            title: 'Eliminar usuario',
            message: `¿Estás seguro de eliminar ${user.email}?`
        });
        if (!confirmed) return;
        try {
            await api.delete(`/users/${user.id}`);
            toast.success('Usuario eliminado');
            onRefresh();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Error al eliminar');
        }
    };

    const applyProfile = (profileId: string) => {
        const profile = profiles.find(p => p.id === profileId);
        if (profile) {
            setUserPermissions(profile.permissions);
            toast.info(`Perfil "${profile.name}" aplicado`);
        }
    };

    const togglePermission = (module: PermissionModule, level: PermissionLevel) => {
        setUserPermissions(prev => ({
            ...prev,
            [module]: level
        }));
    };

    const canEdit = role === 'admin';

    return (
        <>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                <Search className="text-slate-400" size={18} />
                <input
                    type="text"
                    placeholder="Buscar por email..."
                    className="bg-transparent border-none outline-none text-slate-700 dark:text-slate-200 w-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                        <tr>
                            <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Usuario</th>
                            <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Rol</th>
                            <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Creado</th>
                            <th className="text-right p-4 text-xs font-bold text-slate-500 uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredUsers.map(user => (
                            <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                <td className="p-4">
                                    <div className="font-medium text-slate-900 dark:text-white">{user.email}</div>
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${ROLE_BADGE_STYLES[user.role]}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="p-4 text-slate-500 text-sm">
                                    {new Date(user.createdAt).toLocaleDateString('es-ES')}
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <button
                                            onClick={() => handleOpenModal(user)}
                                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                                        >
                                            <Edit size={16} className="text-slate-500" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(user)}
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
                                    {editingUser ? 'Editar usuario' : 'Nuevo usuario'}
                                </h2>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                                    ×
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Contraseña {editingUser && '(dejar vacío para mantener)'}
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Rol</label>
                                    <select
                                        value={role}
                                        onChange={(e) => setRole(e.target.value as Role)}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                    >
                                        {ROLE_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {canEdit && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Permisos</label>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                                            {PERMISSION_MODULES.filter(m => m !== 'dashboard').map(module => (
                                                <label key={module} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!userPermissions[module]}
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
                                )}

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