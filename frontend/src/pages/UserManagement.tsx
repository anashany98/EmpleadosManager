import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
    Shield,
    UserPlus,
    Search,
    Mail,
    Key,
    Edit,
    Trash2,
    X,
    Save,
    Loader2,
    Lock,
    Eye,
    Edit3,
    Ban,
    Copy,
    Plus,
    Users as UsersIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PermissionMatrix {
    [key: string]: 'none' | 'read' | 'write' | 'admin';
}

interface User {
    id: string;
    email: string;
    role: string;
    permissions: PermissionMatrix;
    createdAt: string;
}

interface PermissionProfile {
    id: string;
    name: string;
    permissions: PermissionMatrix;
}

const MODULES = [
    { id: 'dashboard', label: 'Dashboard General' },
    { id: 'employees', label: 'Gestión de Empleados' },
    { id: 'payroll', label: 'Nóminas e Importación' },
    { id: 'companies', label: 'Gestión de Empresas' },
    { id: 'calendar', label: 'Calendario Vacacional' },
    { id: 'timesheet', label: 'Fichajes / Control Horario' },
    { id: 'assets', label: 'Inventario / Activos' },
    { id: 'projects', label: 'Proyectos / Obras' },
    { id: 'reports', label: 'Generación de Reportes' },
    { id: 'audit', label: 'Logs de Auditoría' },
];

import { useConfirm } from '../context/ConfirmContext';

export default function UserManagement() {
    const confirmAction = useConfirm();
    const [activeTab, setActiveTab] = useState<'users' | 'profiles'>('users');
    const [users, setUsers] = useState<User[]>([]);
    const [profiles, setProfiles] = useState<PermissionProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<PermissionProfile | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // User Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('user');
    const [userPermissions, setUserPermissions] = useState<PermissionMatrix>({});

    // Profile Form State
    const [profileName, setProfileName] = useState('');
    const [profilePermissions, setProfilePermissions] = useState<PermissionMatrix>({});

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            await Promise.all([fetchUsers(), fetchProfiles()]);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await api.get('/users');
            setUsers(response.data);
        } catch (error: any) {
            toast.error('Error al cargar usuarios');
        }
    };

    const fetchProfiles = async () => {
        try {
            const response = await api.get('/permission-profiles');
            setProfiles(response.data);
        } catch (error) {
            console.error('Error al cargar perfiles', error);
        }
    };

    const applyProfile = (profileId: string) => {
        const profile = profiles.find(p => p.id === profileId);
        if (profile) {
            setUserPermissions(profile.permissions);
            toast.info(`Perfil "${profile.name}" aplicado`);
        }
    };

    const handleOpenUserModal = (user: User | null = null) => {
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
            setRole('user');
            setUserPermissions({});
        }
        setIsUserModalOpen(true);
    };

    const handleOpenProfileModal = (profile: PermissionProfile | null = null) => {
        if (profile) {
            setEditingProfile(profile);
            setProfileName(profile.name);
            setProfilePermissions(profile.permissions || {});
        } else {
            setEditingProfile(null);
            setProfileName('');
            setProfilePermissions({});
        }
        setIsProfileModalOpen(true);
    };

    const handleUserSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        const payload = {
            email,
            role,
            permissions: userPermissions,
            ...(password ? { password } : {})
        };

        try {
            if (editingUser) {
                await api.put(`/users/${editingUser.id}`, payload);
                toast.success('Usuario actualizado correctamente');
            } else {
                await api.post('/users', payload);
                toast.success('Usuario creado correctamente');
            }
            setIsUserModalOpen(false);
            fetchUsers();
        } catch (error: any) {
            toast.error(error.message || 'Error en la operación');
        } finally {
            setSubmitting(false);
        }
    };

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        const payload = { name: profileName, permissions: profilePermissions };

        try {
            if (editingProfile) {
                await api.put(`/permission-profiles/${editingProfile.id}`, payload);
                toast.success('Perfil actualizado');
            } else {
                await api.post('/permission-profiles', payload);
                toast.success('Perfil creado');
            }
            setIsProfileModalOpen(false);
            fetchProfiles();
        } catch (error: any) {
            toast.error(error.message || 'Error en la operación');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUserDelete = async (id: string) => {
        const ok = await confirmAction({
            title: 'Eliminar Usuario',
            message: '¿Estás seguro de que quieres eliminar este usuario? Esta acción es irreversible.',
            confirmText: 'Eliminar',
            type: 'danger'
        });

        if (!ok) return;
        try {
            await api.delete(`/users/${id}`);
            toast.success('Usuario eliminado');
            fetchUsers();
        } catch (error: any) {
            toast.error('Error al eliminar');
        }
    };

    const handleProfileDelete = async (id: string) => {
        const ok = await confirmAction({
            title: 'Eliminar Perfil de Permisos',
            message: '¿Estás seguro de que quieres borrar este perfil? Los usuarios asignados podrían perder permisos específicos.',
            confirmText: 'Borrar Perfil',
            type: 'danger'
        });

        if (!ok) return;
        try {
            await api.delete(`/permission-profiles/${id}`);
            toast.success('Perfil eliminado');
            fetchProfiles();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const toggleUserPermission = (moduleId: string, level: 'none' | 'read' | 'write') => {
        setUserPermissions(prev => ({
            ...prev,
            [moduleId]: level
        }));
    };

    const toggleProfilePermission = (moduleId: string, level: 'none' | 'read' | 'write') => {
        setProfilePermissions(prev => ({
            ...prev,
            [moduleId]: level
        }));
    };

    const filteredUsers = users.filter(u =>
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Shield className="text-blue-600" />
                        Administración de Accesos
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">Gestiona usuarios y plantillas de permisos</p>
                </div>
                {activeTab === 'users' ? (
                    <button
                        onClick={() => handleOpenUserModal()}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20"
                    >
                        <UserPlus size={18} />
                        Nuevo Usuario
                    </button>
                ) : (
                    <button
                        onClick={() => handleOpenProfileModal()}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20"
                    >
                        <Plus size={18} />
                        Nuevo Perfil
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-900/50 rounded-2xl w-fit border border-slate-200 dark:border-slate-800">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'users'
                        ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm dark:text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                >
                    <UsersIcon size={16} />
                    Usuarios
                </button>
                <button
                    onClick={() => setActiveTab('profiles')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'profiles'
                        ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm dark:text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                >
                    <Copy size={16} />
                    Perfiles
                </button>
            </div>

            {activeTab === 'users' ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
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
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                                    <th className="px-6 py-4">Usuario</th>
                                    <th className="px-6 py-4">Rol</th>
                                    <th className="px-6 py-4">Fecha Alta</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="py-20 text-center">
                                            <Loader2 className="animate-spin inline-block text-blue-600 mb-2" size={32} />
                                            <p className="text-slate-400">Cargando usuarios...</p>
                                        </td>
                                    </tr>
                                ) : filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-20 text-center text-slate-400">No se encontraron usuarios</td>
                                    </tr>
                                ) : filteredUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold">
                                                    {user.email.substring(0, 2).toUpperCase()}
                                                </div>
                                                <span className="font-semibold text-slate-700 dark:text-slate-200">{user.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${user.role === 'admin'
                                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                }`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 text-sm">
                                            {new Date(user.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenUserModal(user)}
                                                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleUserDelete(user.id)}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <div className="col-span-full py-20 text-center">
                            <Loader2 className="animate-spin inline-block text-blue-600 mb-2" size={32} />
                            <p className="text-slate-400">Cargando perfiles...</p>
                        </div>
                    ) : profiles.length === 0 ? (
                        <div className="col-span-full py-20 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                            Aún no has creado ningún perfil de permisos
                        </div>
                    ) : profiles.map(profile => (
                        <motion.div
                            key={profile.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-lg text-slate-800 dark:text-white">{profile.name}</h3>
                                <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all">
                                    <button
                                        onClick={() => handleOpenProfileModal(profile)}
                                        className="p-1.5 text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleProfileDelete(profile.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {Object.entries(profile.permissions).filter(([_, l]) => l !== 'none').slice(0, 4).map(([m, l]) => (
                                    <div key={m} className="flex items-center justify-between text-xs py-1 px-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                        <span className="text-slate-500 capitalize">{MODULES.find(mod => mod.id === m)?.label || m}</span>
                                        <span className={`font-bold ${l === 'write' ? 'text-emerald-500' : 'text-blue-500'}`}>
                                            {l === 'write' ? 'Escritura' : 'Lectura'}
                                        </span>
                                    </div>
                                ))}
                                {Object.entries(profile.permissions).filter(([_, l]) => l !== 'none').length > 4 && (
                                    <p className="text-[10px] text-center text-slate-400 font-medium">+ otros módulos</p>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* User Modal */}
            <AnimatePresence>
                {isUserModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsUserModalOpen(false)}
                            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
                        >
                            <form onSubmit={handleUserSubmit}>
                                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-500/20">
                                            <Shield size={20} />
                                        </div>
                                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                            {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                                        </h2>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsUserModalOpen(false)}
                                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>

                                <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Datos Básicos</h3>
                                            <div className="space-y-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Email</label>
                                                    <div className="relative">
                                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                        <input
                                                            type="email"
                                                            required
                                                            placeholder="ejemplo@empresa.com"
                                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-12 pr-4 text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                            value={email}
                                                            onChange={(e) => setEmail(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Contraseña {editingUser && '(Dejar en blanco para no cambiar)'}</label>
                                                    <div className="relative">
                                                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                        <input
                                                            type="password"
                                                            required={!editingUser}
                                                            placeholder="••••••••"
                                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 pl-12 pr-4 text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                            value={password}
                                                            onChange={(e) => setPassword(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Rol de Sistema</label>
                                                    <select
                                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-4 text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                        value={role}
                                                        onChange={(e) => setRole(e.target.value)}
                                                    >
                                                        <option value="user">Usuario Estándar</option>
                                                        <option value="admin">Administrador (Acceso Total)</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Matriz de Permisos</h3>
                                                {role !== 'admin' && profiles.length > 0 && (
                                                    <div className="flex items-center gap-2">
                                                        <Copy size={14} className="text-slate-400" />
                                                        <select
                                                            className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 border-none rounded-lg py-1 px-2 text-slate-600 dark:text-slate-300 outline-none"
                                                            onChange={(e) => applyProfile(e.target.value)}
                                                            defaultValue=""
                                                        >
                                                            <option value="" disabled>Cargar Perfil...</option>
                                                            {profiles.map(p => (
                                                                <option key={p.id} value={p.id}>{p.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>

                                            {role === 'admin' ? (
                                                <div className="flex flex-col items-center justify-center h-48 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30 text-center p-6 gap-2">
                                                    <Lock size={32} className="text-blue-600 mb-2" />
                                                    <p className="font-bold text-blue-700 dark:text-blue-400">Acceso de Administrador</p>
                                                    <p className="text-xs text-blue-600/70 dark:text-blue-400/70">Los administradores tienen permiso de escritura en todos los módulos por defecto.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {MODULES.map(module => (
                                                        <div key={module.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900/40 transition-all group">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{module.label}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-lg">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleUserPermission(module.id, 'none')}
                                                                    className={`p-1.5 rounded-md transition-all ${userPermissions[module.id] === 'none' || !userPermissions[module.id] ? 'bg-rose-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                                                    title="Sin Acceso"
                                                                >
                                                                    <Ban size={14} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleUserPermission(module.id, 'read')}
                                                                    className={`p-1.5 rounded-md transition-all ${userPermissions[module.id] === 'read' ? 'bg-blue-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                                                    title="Sólo Lectura"
                                                                >
                                                                    <Eye size={14} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleUserPermission(module.id, 'write')}
                                                                    className={`p-1.5 rounded-md transition-all ${userPermissions[module.id] === 'write' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                                                    title="Escritura"
                                                                >
                                                                    <Edit3 size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsUserModalOpen(false)}
                                        className="px-6 py-2.5 text-slate-600 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-white transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-8 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20"
                                    >
                                        {submitting ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : (
                                            <Save size={18} />
                                        )}
                                        {editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Profile Modal */}
            <AnimatePresence>
                {isProfileModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsProfileModalOpen(false)}
                            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
                        >
                            <form onSubmit={handleProfileSubmit}>
                                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-500/20">
                                            <Copy size={20} />
                                        </div>
                                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                            {editingProfile ? 'Editar Perfil' : 'Nuevo Perfil'}
                                        </h2>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsProfileModalOpen(false)}
                                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>

                                <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Nombre del Perfil</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ej: Solo Lectura RRHH, Admin Proyectos..."
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-4 text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            value={profileName}
                                            onChange={(e) => setProfileName(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Matriz de Permisos</h3>
                                        <div className="space-y-2">
                                            {MODULES.map(module => (
                                                <div key={module.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{module.label}</span>
                                                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-lg">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleProfilePermission(module.id, 'none')}
                                                            className={`p-1.5 rounded-md transition-all ${profilePermissions[module.id] === 'none' || !profilePermissions[module.id] ? 'bg-rose-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                                        >
                                                            <Ban size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleProfilePermission(module.id, 'read')}
                                                            className={`p-1.5 rounded-md transition-all ${profilePermissions[module.id] === 'read' ? 'bg-blue-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleProfilePermission(module.id, 'write')}
                                                            className={`p-1.5 rounded-md transition-all ${profilePermissions[module.id] === 'write' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                                        >
                                                            <Edit3 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsProfileModalOpen(false)}
                                        className="px-6 py-2.5 text-slate-600 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-white transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-8 py-2.5 rounded-xl font-bold transition-all shadow-lg"
                                    >
                                        {submitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                        {editingProfile ? 'Actualizar Perfil' : 'Guardar Perfil'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
