import { type FormEvent, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Copy, Edit, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import type { PermissionMap } from '@shared/authz';
import { toast } from 'sonner';
import { api } from '../api/client';
import { useConfirm } from '../context/ConfirmContext';
import { useClickOutside } from '../hooks/useClickOutside';
import UserManagementPermissionEditor from './UserManagementPermissionEditor';
import { countEnabledPermissions, getEnabledModules, MODULE_LABELS, parseApiError } from './userManagementShared';

interface PermissionProfile {
    id: string;
    name: string;
    permissions: PermissionMap;
    createdAt?: string;
    updatedAt?: string;
}

interface ProfilesTabProps {
    profiles: PermissionProfile[];
    onRefresh: () => Promise<void> | void;
}

export default function UserManagementProfilesTab({ profiles, onRefresh }: ProfilesTabProps) {
    const confirmAction = useConfirm();
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<PermissionProfile | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [profileName, setProfileName] = useState('');
    const [profilePermissions, setProfilePermissions] = useState<PermissionMap>({});

    const filteredProfiles = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) {
            return profiles;
        }

        return profiles.filter((profile) => profile.name.toLowerCase().includes(query));
    }, [profiles, searchQuery]);

    const modalRef = useClickOutside<HTMLDivElement>(() => setIsModalOpen(false));
    const emptyMessage = searchQuery
        ? 'No se encontraron perfiles con ese nombre.'
        : 'Todavía no hay perfiles de permisos creados.';

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

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSubmitting(true);

        try {
            const payload = {
                name: profileName.trim(),
                permissions: profilePermissions
            };

            if (editingProfile) {
                await api.put(`/permission-profiles/${editingProfile.id}`, payload);
                toast.success('Perfil actualizado');
            } else {
                await api.post('/permission-profiles', payload);
                toast.success('Perfil creado');
            }

            setIsModalOpen(false);
            await Promise.resolve(onRefresh());
        } catch (error) {
            toast.error(parseApiError(error, 'Error al guardar el perfil.'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (profile: PermissionProfile) => {
        const confirmed = await confirmAction({
            title: 'Eliminar perfil',
            message: `¿Estás seguro de eliminar el perfil "${profile.name}"?`
        });

        if (!confirmed) {
            return;
        }

        try {
            await api.delete(`/permission-profiles/${profile.id}`);
            toast.success('Perfil eliminado');
            await Promise.resolve(onRefresh());
        } catch (error) {
            toast.error(parseApiError(error, 'Error al eliminar el perfil.'));
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
                            placeholder="Buscar perfil..."
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
                        <Plus size={18} />
                        Nuevo perfil
                    </button>
                </div>
            </div>

            {filteredProfiles.length === 0 ? (
                <div className="p-6 text-center sm:p-8">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{emptyMessage}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {searchQuery ? 'Prueba con otra búsqueda.' : 'Crea un perfil reutilizable para usuarios RRHH, managers o empleados.'}
                    </p>
                </div>
            ) : (
                <>
                    <div className="hidden md:block table-responsive">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr>
                                    <th className="p-4 text-xs font-bold uppercase text-slate-500">Perfil</th>
                                    <th className="p-4 text-xs font-bold uppercase text-slate-500">Permisos</th>
                                    <th className="p-4 text-xs font-bold uppercase text-slate-500">Actualizado</th>
                                    <th className="p-4 text-right text-xs font-bold uppercase text-slate-500">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {filteredProfiles.map((profile) => {
                                    const enabledModules = getEnabledModules(profile.permissions);

                                    return (
                                        <tr key={profile.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                            <td className="p-4">
                                                <div className="font-medium text-slate-900 dark:text-white">{profile.name}</div>
                                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{countEnabledPermissions(profile.permissions)} módulos habilitados</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {enabledModules.length > 0 ? (
                                                        enabledModules.slice(0, 6).map((module) => (
                                                            <span key={module} className="rounded px-2 py-0.5 text-xs text-slate-600 bg-slate-100 dark:bg-slate-700 dark:text-slate-300">
                                                                {MODULE_LABELS[module]}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-slate-400 dark:text-slate-500">Sin permisos activos</span>
                                                    )}
                                                    {enabledModules.length > 6 && (
                                                        <span className="rounded px-2 py-0.5 text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300">
                                                            +{enabledModules.length - 6} más
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-slate-500 dark:text-slate-400">
                                                {new Date(profile.updatedAt || profile.createdAt || Date.now()).toLocaleDateString('es-ES')}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button type="button" onClick={() => handleOpenModal(profile)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700">
                                                        <Edit size={16} className="text-slate-500" />
                                                    </button>
                                                    <button type="button" onClick={() => void handleDelete(profile)} className="rounded-lg p-2 hover:bg-red-50 dark:hover:bg-red-900/20">
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
                        {filteredProfiles.map((profile) => {
                            const enabledModules = getEnabledModules(profile.permissions);

                            return (
                                <article key={profile.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-slate-900 dark:text-white">{profile.name}</p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{countEnabledPermissions(profile.permissions)} módulos habilitados</p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button type="button" onClick={() => handleOpenModal(profile)} className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                                                <Edit size={16} />
                                            </button>
                                            <button type="button" onClick={() => void handleDelete(profile)} className="rounded-lg border border-red-200 p-2 text-red-500 transition hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-900/20">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                                        {enabledModules.length > 0 ? (
                                            enabledModules.slice(0, 5).map((module) => (
                                                <span key={module} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                    {MODULE_LABELS[module]}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-sm text-slate-500 dark:text-slate-400">Sin permisos activos</span>
                                        )}
                                        {enabledModules.length > 5 && (
                                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                                                +{enabledModules.length - 5} más
                                            </span>
                                        )}
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
                                        {editingProfile ? 'Editar perfil' : 'Nuevo perfil'}
                                    </h2>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Crea plantillas reutilizables con permisos exactos por módulo.
                                    </p>
                                </div>
                                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6 p-4 sm:p-6">
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_240px]">
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre del perfil</label>
                                        <input
                                            type="text"
                                            required
                                            value={profileName}
                                            onChange={(event) => setProfileName(event.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                            placeholder="Ej: RRHH lectura, Manager operaciones..."
                                        />
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                                            <Copy size={16} className="text-blue-500" />
                                            Resumen
                                        </div>
                                        <p className="mt-3 text-3xl font-black text-blue-600 dark:text-blue-300">{countEnabledPermissions(profilePermissions)}</p>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">módulos con acceso activo</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Matriz de permisos</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Cada módulo puede quedar sin acceso, solo lectura o lectura y escritura.</p>
                                    <UserManagementPermissionEditor
                                        permissions={profilePermissions}
                                        onChange={(module, level) => setProfilePermissions((current) => ({ ...current, [module]: level }))}
                                    />
                                </div>

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
                                        Guardar perfil
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
