import { Link, useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard, Users, Network, Building2, Calendar as CalendarIcon, Clock, Package, History, FileText, FileSpreadsheet, Settings, Shield, Inbox, Plane } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    darkMode: boolean;
}

export const navItems = [
    { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} />, module: 'dashboard' },
    { path: '/profile', label: 'Mi Perfil', icon: <Users size={20} />, module: 'calendar' }, // Accessible to employees
    { path: '/vacations', label: 'Vacaciones', icon: <Plane size={20} />, module: 'calendar' },
    { path: '/employees', label: 'Empleados', icon: <Users size={20} />, module: 'employees' },
    { path: '/employees/org-chart', label: 'Organigrama', icon: <Network size={20} />, module: 'employees' },
    { path: '/companies', label: 'Empresas', icon: <Building2 size={20} />, module: 'companies' },
    { path: '/calendar', label: 'Calendario', icon: <CalendarIcon size={20} />, module: 'calendar' },
    { path: '/timesheet', label: 'Fichajes', icon: <Clock size={20} />, module: 'timesheet' },
    { path: '/assets', label: 'Inventario', icon: <Package size={20} />, module: 'assets' },
    { path: '/inbox', label: 'Bandeja de Entrada', icon: <Inbox size={20} />, module: 'employees' },
    { path: '/audit', label: 'Auditoría', icon: <History size={20} />, module: 'audit' },
    { path: '/reports', label: 'Reportes', icon: <FileText size={20} />, module: 'reports' },
    { path: '/import', label: 'Importar Nómina', icon: <FileSpreadsheet size={20} />, module: 'payroll' },
    { path: '/users', label: 'Usuarios', icon: <Shield size={20} />, module: 'admin' },
    { path: '/settings', label: 'Configuración', icon: <Settings size={20} />, module: 'settings' },
];

export function Sidebar({ sidebarOpen, setSidebarOpen, darkMode }: SidebarProps) {
    const location = useLocation();
    const { user, logout } = useAuth();

    return (
        <>
            <AnimatePresence>
                {sidebarOpen && window.innerWidth <= 768 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSidebarOpen(false)}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
                    />
                )}
            </AnimatePresence>

            <aside className={`
                fixed md:relative z-50 h-full transition-all duration-300 border-r 
                ${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full md:w-20 md:translate-x-0'}
                ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}
            `}>
                <div className={`p-6 border-b flex items-center justify-between ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    <div className={`font-bold flex items-center gap-2 overflow-hidden ${!sidebarOpen && 'md:hidden'}`}>
                        <div className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                            E
                        </div>
                        <span className={`text-base leading-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>Empleados Manager APP</span>
                    </div>
                    <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 text-slate-400">
                        <LogOut size={20} className="rotate-180" />
                    </button>
                </div>

                <nav className="p-4 space-y-1 mt-4 h-[calc(100vh-160px)] overflow-y-auto custom-scrollbar">
                    {navItems.filter(item => {
                        if (!user) return false;
                        if (user.role === 'admin') return true;

                        // Admin only items
                        if (item.module === 'admin' || item.module === 'settings') return false;

                        // Granular permissions
                        const level = user.permissions?.[item.module] || 'none';
                        return level !== 'none';
                    }).map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`
                                    flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden
                                    ${isActive
                                        ? (darkMode ? 'bg-blue-600/10 text-blue-400' : 'bg-blue-50 text-blue-700')
                                        : (darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')}
                                `}
                                title={!sidebarOpen ? item.label : ''}
                            >
                                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full" />}
                                <div className={`${sidebarOpen ? '' : 'mx-auto shrink-0'}`}>{item.icon}</div>
                                <span className={`font-medium whitespace-nowrap ${!sidebarOpen ? 'hidden' : 'block'}`}>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className={`absolute bottom-0 w-full p-4 border-t ${darkMode ? 'border-slate-800' : 'border-slate-100'} ${!sidebarOpen && 'hidden'}`}>
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 ring-2 ring-white/20 flex items-center justify-center text-[10px] text-white font-bold">
                            {user?.email?.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className={`text-sm font-semibold truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{user?.email.split('@')[0]}</p>
                            <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
                        </div>
                        <LogOut size={16} className="text-slate-400 hover:text-red-400 cursor-pointer" onClick={logout} />
                    </div>
                </div>
            </aside>
        </>
    );
}
