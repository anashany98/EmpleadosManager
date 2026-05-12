import { type FormEvent, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Edit, Loader2, Search, ShieldCheck, ShieldOff, Trash2, UserPlus, X } from 'lucide-react';
import type { PermissionLevel, PermissionMap, PermissionModule, Role } from '@shared/authz';
import { getDefaultPermissionsForRole } from '@shared/authz';
import { toast } from 'sonner';
import { api } from '../api/client';
import { useConfirm } from '../context/ConfirmContext';
import { useAuth } from '../contexts/AuthContext';
import { useClickOutside } from '../hooks/useClickOutside';
import UserManagementPermissionEditor from './UserManagementPermissionEditor';
import {
    ROLE_BADGE_STYLES,
    ROLE_LABELS,
    ROLE_OPTIONS,
    countEnabledPermissions,
    parseApiError
} from './userManagementShared';

interface User {
    id: string;
    email: string;
    role: Role;
    permissions: PermissionMap;
    isActive: boolean;
    createdAt: string;
}

interface PermissionProfile {
    id: string;
    name: string;
    permissions: PermissionMap;
}

interface UserFormData {
    email: string;
    password?: string;
    role: Role;
    permissions: PermissionMap;
    isActive?: boolean;
}

interface UsersTabProps {
    users: User[];
    profiles: PermissionProfile[];
    onRefresh: () => Promise<void> | void;
}

export default function UserManagementUsersTab({ users, profiles, onRefresh }: UsersTabProps) {
    const confirmAction = useConfirm();
    const { user: currentUser } = useAuth();

    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<Role>('employee');
    const [selectedProfileId, setSelectedProfileId] = useState('');
    const [userPermissions, setUserPermissions] = useState<PermissionMap>(getDefaultPermissionsForRole('employee'));
    const [isActive, setIsActive] = useState(true);

    const filteredUsers = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) {
            return users;
        }

        return users.filter((user) => user.email.toLowerCase().includes(query));
    }, [searchQuery, users]);

    const activeAdminCount = useMemo(
        () => users.filter((user) => user.role === 'admin' && user.isActive).length,
        [users]
    );

    const modalRef = useClickOutside<HTMLDivElement>(() => setIsModalOpen(false));
    const isEditingSelf = editingUser?.id === currentUser?.id;
    const emptyMessage = searchQuery
        ? 'No se encontraron usuarios con ese email.'
        : 'Todavía no hay usuarios creados.';

    const resetForm = (nextRole: Role = 'employee') => {
        setEditingUser(null);
        setEmail('');
        setPassword('');
        setRole(nextRole);
        setSelectedProfileId('');
        setUserPermissions(getDefaultPermissionsForRole(nextRole));
        setIsActive(true);
    };

    const handleOpenModal = (user: User | null = null) => {
        if (user) {
            setEditingUser(user);
            setEmail(user.email);
            setPassword('');
            setRole(user.role);
            setSelectedProfileId('');
            setUserPermissions(user.permissions || getDefaultPermissionsForRole(user.role));
            setIsActive(user.isActive);
        } else {
            resetForm();
        }

        setIsModalOpen(true);
    };

    const handleRoleChange = (nextRole: Role) => {
        setRole(nextRole);
        setSelectedProfileId('');
        setUserPermissions(getDefaultPermissionsForRole(nextRole));
    };

    const applyProfile = (profileId: string) => {
        setSelectedProfileId(profileId);

        if (!profileId) {
            setUserPermissions(getDefaultPermissionsForRole(role));
            return;
        }

        const profile = profiles.find((item) => item.id === profileId);
        if (!profile) {
            return;
        }

        setUserPermissions({ ...profile.permissions });
        toast.success(`Perfil "${profile.name}" aplicado`);
    };

    const updatePermission = (module: PermissionModule, level: PermissionLevel) => {
        setUserPermissions((previous) => ({
            ...previous,
            [module]: level
        }));
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSubmitting(true);

        try {
            const payload: UserFormData = {
                email: email.trim(),
                role,
                permissions: role === 'admin' ? getDefaultPermissionsForRole('admin') : userPermissions,
                isActive
            };

            if (password.trim()) {
                payload.password = password.trim();
            }

            if (!editingUser && !payload.password) {
                toast.error('La contraseña es obligatoria para crear el usuario.');
                return;
            }

            if (editingUser) {
                await api.put(`/users/${editingUser.id}`, payload);
                toast.success('Usuario actualizado');
            } else {
                await api.post('/users', payload);
                toast.success('Usuario creado');
            }

            setIsModalOpen(false);
            resetForm();
            await Promise.resolve(onRefresh());
        } catch (error) {
            toast.error(parseApiError(error, 'Error al guardar el usuario.'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleActive = async (user: User) => {
        if (user.id === currentUser?.id) {
            toast.error('No puedes desactivar tu propio usuario desde esta pantalla.');
            return;
        }

        try {
            await api.patch(`/users/${user.id}/toggle-active`, { isActive: !user.isActive });
            toast.success(user.isActive ? 'Usuario desactivado' : 'Usuario activado');
            await Promise.resolve(onRefresh());
        } catch (error) {
            toast.error(parseApiError(error, 'Error al cambiar el estado del usuario.'));
        }
    };

    const handleDelete = async (user: User) => {
        if (user.id === currentUser?.id) {
            toast.error('No puedes eliminar tu propio usuario.');
            return;
        }

        const confirmed = await confirmAction({
            title: 'Eliminar usuario',
            message: `¿Estás seguro de eliminar ${user.email}?`
        });

        if (!confirmed) {
            return;
        }

        try {
            await api.delete(`/users/${user.id}`);
            toast.success('Usuario eliminado');
            await Promise.resolve(onRefresh());
        } catch (error) {
            toast.error(parseApiError(error, 'Error al eliminar el usuario.'));
        }
    };

    return (
        <>
            <div className="border-b border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/60">
                        <Search className="text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por email..."
                            className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => handleOpenModal()}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 sm:w-auto"
                    >
                        <UserPlus size={18} />
                        Nuevo usuario
                    </button>
                </div>
            </div>

            {filteredUsers.length === 0 ? (
                <div className="p-6 text-center sm:p-8">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{emptyMessage}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {searchQuery ? 'Prueba con otra búsqueda.' : 'Crea el primero desde el botón superior.'}
                    </p>
                </div>
            ) : (
                <>
                    <div className="hidden md:block table-responsive">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr>
                                    <th className="p-4 text-xs font-bold uppercase text-slate-500">Usuario</th>
                                    <th className="p-4 text-xs font-bold uppercase text-slate-500">Estado</th>
                                    <th className="p-4 text-xs font-bold uppercase text-slate-500">Rol</th>
                                    <th className="p-4 text-xs font-bold uppercase text-slate-500">Permisos</th>
                                    <th className="p-4 text-xs font-bold uppercase text-slate-500">Creado</th>
                                    <th className="p-4 text-right text-xs font-bold uppercase text-slate-500">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {filteredUsers.map((user) => {
                                    const isCurrentUser = user.id === currentUser?.id;
                                    const isLastActiveAdmin = user.role === 'admin' && user.isActive && activeAdminCount <= 1;

                                    return (
                                        <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                            <td className="p-4">
                                                <div className="font-medium text-slate-900 dark:text-white">{user.email}</div>
                                                {isCurrentUser && <div className="mt-1 text-xs text-blue-600 dark:text-blue-300">Tu sesión actual</div>}
                                            </td>
                                            <td className="p-4">
                                                <span className={`rounded-lg px-2 py-1 text-xs font-bold ${user.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                                                    {user.isActive ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`rounded-lg px-2 py-1 text-xs font-bold ${ROLE_BADGE_STYLES[user.role]}`}>
                                                    {ROLE_LABELS[user.role]}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-slate-500 dark:text-slate-400">
                                                {countEnabledPermissions(user.permissions)} módulos
                                            </td>
                                            <td className="p-4 text-sm text-slate-500 dark:text-slate-400">
                                                {new Date(user.createdAt).toLocaleDateString('es-ES')}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenModal(user)}
                                                        className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700"
                                                        title="Editar usuario"
                                                    >
                                                        <Edit size={16} className="text-slate-500" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleToggleActive(user)}
                                                        disabled={isCurrentUser || isLastActiveAdmin}
                                                        className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-700"
                                                        title={user.isActive ? 'Desactivar usuario' : 'Activar usuario'}
                                                    >
                                                        {user.isActive ? <ShieldOff size={16} className="text-amber-500" /> : <ShieldCheck size={16} className="text-emerald-500" />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleDelete(user)}
                                                        disabled={isCurrentUser || isLastActiveAdmin}
                                                        className="rounded-lg p-2 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-900/20"
                                                        title="Eliminar usuario"
                                                    >
                                                        <Trash2 size={16} className="text-red-500" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="space-y-3 p-4 md:hidden">
                        {filteredUsers.map((user) => {
                            const isCurrentUser = user.id === currentUser?.id;
                            const isLastActiveAdmin = user.role === 'admin' && user.isActive && activeAdminCount <= 1;

                            return (
                                <article
                                    key={user.id}
                                    className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold text-slate-900 dark:text-white">{user.email}</p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                Creado el {new Date(user.createdAt).toLocaleDateString('es-ES')}
                                            </p>
                                            {isCurrentUser && <p className="mt-1 text-xs text-blue-600 dark:text-blue-300">Tu sesión actual</p>}
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <span className={`rounded-lg px-2 py-1 text-[11px] font-bold ${ROLE_BADGE_STYLES[user.role]}`}>
                                                {ROLE_LABELS[user.role]}
                                            </span>
                                            <span className={`rounded-lg px-2 py-1 text-[11px] font-bold ${user.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                                                {user.isActive ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                                        <span className="text-sm text-slate-500 dark:text-slate-400">
                                            {countEnabledPermissions(user.permissions)} módulos activos
                                        </span>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenModal(user)}
                                                className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleToggleActive(user)}
                                                disabled={isCurrentUser || isLastActiveAdmin}
                                                className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                            >
                                                {user.isActive ? <ShieldOff size={16} className="text-amber-500" /> : <ShieldCheck size={16} className="text-emerald-500" />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleDelete(user)}
                                                disabled={isCurrentUser || isLastActiveAdmin}
                                                className="rounded-lg border border-red-200 p-2 text-red-500 transition hover:bg-red-50 disabled:opacity-40 dark:border-red-900/50 dark:hover:bg-red-900/20"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </>
            )}

            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-0 sm:items-center sm:justify-center sm:p-4">
                        <motion.div
                            ref={modalRef}
                            initial={{ opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 24 }}
                            className="safe-bottom w-full max-w-5xl overflow-y-auto rounded-t-3xl bg-white shadow-xl dark:bg-slate-900 sm:max-h-[90vh] sm:rounded-2xl"
                        >
                            <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800 sm:p-6">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">
                                        {editingUser ? 'Editar usuario' : 'Nuevo usuario'}
                                    </h2>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Configura rol, estado y permisos reales del usuario.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6 p-4 sm:p-6">
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    <div>
                                        <label htmlFor="user-email" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                                        <input
                                            id="user-email"
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(event) => setEmail(event.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="user-password" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Contraseña {editingUser ? '(dejar vacío para mantener)' : ''}
                                        </label>
                                        <input
                                            id="user-password"
                                            type="password"
                                            required={!editingUser}
                                            value={password}
                                            onChange={(event) => setPassword(event.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                                    <div>
                                        <label htmlFor="user-role" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Rol</label>
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                            {ROLE_OPTIONS.map((option) => {
                                                const isSelected = role === option.value;

                                                return (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => handleRoleChange(option.value)}
                                                        className={`rounded-2xl border px-4 py-3 text-left transition ${isSelected ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}
                                                    >
                                                        <div className="text-sm font-bold text-slate-900 dark:text-white">{option.label}</div>
                                                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{option.description}</div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                        <div>
                                            <label htmlFor="user-status" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Estado</label>
                                            <button
                                                type="button"
                                                onClick={() => !isEditingSelf && setIsActive((current) => !current)}
                                                disabled={isEditingSelf}
                                                className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${isActive ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'} disabled:opacity-50`}
                                            >
                                                {isActive ? <ShieldCheck size={16} /> : <ShieldOff size={16} />}
                                                {isActive ? 'Usuario activo' : 'Usuario inactivo'}
                                            </button>
                                            {isEditingSelf && (
                                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                    Tu propia sesión no se puede desactivar desde esta pantalla.
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            <label htmlFor="permission-profile" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Plantilla de permisos</label>
                                            <select
                                                id="permission-profile"
                                                value={selectedProfileId}
                                                onChange={(event) => applyProfile(event.target.value)}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                            >
                                                <option value="">Usar permisos por rol</option>
                                                {profiles.map((profile) => (
                                                    <option key={profile.id} value={profile.id}>
                                                        {profile.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {role === 'admin' ? (
                                    <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/30 dark:bg-blue-900/10 dark:text-blue-300">
                                        El rol Administrador global siempre conserva acceso completo. Los perfiles de permisos están pensados para RRHH, managers y empleados.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Permisos efectivos</h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">Ajusta exactamente qué podrá ver o gestionar el usuario.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedProfileId('');
                                                    setUserPermissions(getDefaultPermissionsForRole(role));
                                                }}
                                                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                            >
                                                Restablecer por rol
                                            </button>
                                        </div>

                                        <UserManagementPermissionEditor permissions={userPermissions} onChange={updatePermission} />
                                    </div>
                                )}

                                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 sm:w-auto"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
                                    >
                                        {submitting && <Loader2 className="animate-spin" size={18} />}
                                        Guardar usuario
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
