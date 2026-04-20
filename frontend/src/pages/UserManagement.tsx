import { useState, useEffect } from 'react';
import { api } from '../api/client';
import {
    Shield,
    UserPlus,
    Copy,
    Users as UsersIcon
} from 'lucide-react';
import type { PermissionMap, Role } from '@shared/authz';
import UserManagementUsersTab from './UserManagementUsersTab';
import UserManagementProfilesTab from './UserManagementProfilesTab';

interface User {
    id: string;
    email: string;
    role: Role;
    permissions: PermissionMap;
    createdAt: string;
}

interface PermissionProfile {
    id: string;
    name: string;
    permissions: PermissionMap;
}

export default function UserManagement() {
    const [activeTab, setActiveTab] = useState<'users' | 'profiles'>('users');
    const [users, setUsers] = useState<User[]>([]);
    const [profiles, setProfiles] = useState<PermissionProfile[]>([]);
    const [loading, setLoading] = useState(true);

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
        } catch (error) {
            console.error('Error loading users');
        }
    };

    const fetchProfiles = async () => {
        try {
            const response = await api.get('/permission-profiles');
            setProfiles(response.data);
        } catch (error) {
            console.error('Error loading profiles');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

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
                <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-900/50 rounded-2xl w-fit border border-slate-200 dark:border-slate-800">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                            activeTab === 'users'
                                ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm dark:text-white'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <UsersIcon size={16} />
                        Usuarios
                    </button>
                    <button
                        onClick={() => setActiveTab('profiles')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                            activeTab === 'profiles'
                                ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm dark:text-white'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <Copy size={16} />
                        Perfiles
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                {activeTab === 'users' ? (
                    <UserManagementUsersTab
                        users={users}
                        profiles={profiles}
                        onRefresh={fetchData}
                    />
                ) : (
                    <UserManagementProfilesTab
                        profiles={profiles}
                        onRefresh={fetchData}
                    />
                )}
            </div>
        </div>
    );
}