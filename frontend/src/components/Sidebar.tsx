import { Link, useLocation } from 'react-router-dom';
import { 
    LogOut, LayoutDashboard, Users, Network, Building2, Calendar as CalendarIcon, 
    Clock, Package, History, FileText, FileSpreadsheet, Settings, Shield, 
    Inbox, Plane, DollarSign, AlertTriangle, ChevronDown, ChevronRight, User, BarChart3, Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';

interface SidebarProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    darkMode: boolean;
}

interface NavItem {
    path: string;
    label: string;
    icon: React.ReactNode;
    module: string;
    category?: string;
}

interface NavCategory {
    id: string;
    label: string;
    icon: React.ReactNode;
    items: NavItem[];
}

// Navigation items organized by category
const navCategories: NavCategory[] = [
    {
        id: 'personal',
        label: 'Personal',
        icon: <User size={16} />,
        items: [
            { path: '/my-documents', label: 'Mis Documentos', icon: <FileText size={18} />, module: 'calendar' },
            { path: '/profile', label: 'Mi Perfil', icon: <Users size={18} />, module: 'calendar' },
            { path: '/vacations', label: 'Vacaciones', icon: <Plane size={18} />, module: 'calendar' },
        ]
    },
    {
        id: 'management',
        label: 'Gestión',
        icon: <LayoutDashboard size={16} />,
        items: [
            { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} />, module: 'dashboard' },
            { path: '/employees', label: 'Empleados', icon: <Users size={18} />, module: 'employees' },
            { path: '/employees/org-chart', label: 'Organigrama', icon: <Network size={18} />, module: 'employees' },
            { path: '/companies', label: 'Empresas', icon: <Building2 size={18} />, module: 'companies' },
        ]
    },
    {
        id: 'time',
        label: 'Tiempo y Asistencia',
        icon: <Clock size={16} />,
        items: [
            { path: '/calendar', label: 'Calendario', icon: <CalendarIcon size={18} />, module: 'calendar' },
            { path: '/timesheet', label: 'Fichajes', icon: <Clock size={18} />, module: 'timesheet' },
            { path: '/expenses', label: 'Gastos', icon: <DollarSign size={18} />, module: 'timesheet' },
        ]
    },
    {
        id: 'operations',
        label: 'Operaciones',
        icon: <Package size={16} />,
        items: [
            { path: '/assets', label: 'Inventario', icon: <Package size={18} />, module: 'assets' },
            { path: '/inbox', label: 'Bandeja de Entrada', icon: <Inbox size={18} />, module: 'employees' },
        ]
    },
    {
        id: 'admin',
        label: 'Administración',
        icon: <Shield size={16} />,
        items: [
            { path: '/analytics', label: 'Analytics', icon: <BarChart3 size={18} />, module: 'reports' },
            { path: '/performance', label: 'Desempeño', icon: <Target size={18} />, module: 'reports' },
            { path: '/audit', label: 'Auditoría', icon: <History size={18} />, module: 'audit' },
            { path: '/reports', label: 'Reportes', icon: <FileText size={18} />, module: 'reports' },
            { path: '/anomalies', label: 'Anomalías', icon: <AlertTriangle size={18} />, module: 'admin' },
            { path: '/import', label: 'Importar Nómina', icon: <FileSpreadsheet size={18} />, module: 'payroll' },
            { path: '/users', label: 'Usuarios', icon: <Shield size={18} />, module: 'admin' },
            { path: '/settings', label: 'Configuración', icon: <Settings size={18} />, module: 'settings' },
        ]
    }
];

// Flat list for backward compatibility
export const navItems: NavItem[] = navCategories.flatMap(cat => cat.items);

export function Sidebar({ sidebarOpen, setSidebarOpen, darkMode }: SidebarProps) {
    const location = useLocation();
    const { user, logout } = useAuth();
    const [expandedCategories, setExpandedCategories] = useState<string[]>(['personal', 'management', 'time', 'operations', 'admin']);

    const toggleCategory = (categoryId: string) => {
        setExpandedCategories(prev => 
            prev.includes(categoryId) 
                ? prev.filter(id => id !== categoryId)
                : [...prev, categoryId]
        );
    };

    const hasPermission = (item: NavItem): boolean => {
        if (!user) return false;
        if (user.role?.toLowerCase() === 'admin') return true;
        
        // Admin only items
        if (item.module === 'admin' || item.module === 'settings') return false;
        
        // Granular permissions
        const level = user.permissions?.[item.module] || 'none';
        return level !== 'none';
    };

    const hasVisibleItems = (category: NavCategory): boolean => {
        return category.items.some(item => hasPermission(item));
    };

    return (
        <>
            {/* Mobile overlay */}
            <AnimatePresence>
                {sidebarOpen && window.innerWidth <= 768 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSidebarOpen(false)}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
                        aria-hidden="true"
                    />
                )}
            </AnimatePresence>

            <aside 
                id="sidebar"
                className={`
                    fixed md:relative z-50 h-full transition-all duration-300 border-r 
                    ${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full md:w-20 md:translate-x-0'}
                    ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}
                `}
                role="navigation"
                aria-label="Navegación principal"
            >
                {/* Logo Section */}
                <div className={`p-4 md:p-6 border-b flex items-center justify-between ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    <div className={`font-bold flex items-center gap-2 overflow-hidden ${!sidebarOpen && 'md:hidden'}`}>
                        <div className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                            E
                        </div>
                        <span className={`text-base leading-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            Empleados Manager
                        </span>
                    </div>
                    <button 
                        onClick={() => setSidebarOpen(false)} 
                        className="md:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
                        aria-label="Cerrar menú de navegación"
                    >
                        <LogOut size={20} className="rotate-180" />
                    </button>
                </div>

                {/* Navigation */}
                <nav 
                    className="p-2 md:p-4 space-y-1 h-[calc(100vh-160px)] overflow-y-auto custom-scrollbar"
                    aria-label="Menú principal"
                >
                    {navCategories.map((category) => {
                        if (!hasVisibleItems(category)) return null;
                        
                        const isExpanded = expandedCategories.includes(category.id);
                        
                        return (
                            <div key={category.id} className="mb-2">
                                {/* Category Header */}
                                <button
                                    onClick={() => toggleCategory(category.id)}
                                    className={`
                                        w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider
                                        ${darkMode 
                                            ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50' 
                                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                        }
                                        transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                                        ${!sidebarOpen && 'md:hidden'}
                                    `}
                                    aria-expanded={isExpanded}
                                    aria-controls={`category-${category.id}`}
                                >
                                    <span className="opacity-60">{category.icon}</span>
                                    <span className="flex-1 text-left">{category.label}</span>
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>

                                {/* Category Items */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            id={`category-${category.id}`}
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <ul className="mt-1 space-y-0.5" role="list">
                                                {category.items.map((item) => {
                                                    if (!hasPermission(item)) return null;
                                                    
                                                    const isActive = location.pathname === item.path;
                                                    
                                                    return (
                                                        <li key={item.path}>
                                                            <Link
                                                                to={item.path}
                                                                className={`
                                                                    flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden
                                                                    ${isActive
                                                                        ? (darkMode ? 'bg-blue-600/10 text-blue-400' : 'bg-blue-50 text-blue-700')
                                                                        : (darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')
                                                                    }
                                                                    focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                                                                `}
                                                                title={!sidebarOpen ? item.label : ''}
                                                                aria-current={isActive ? 'page' : undefined}
                                                            >
                                                                {isActive && (
                                                                    <div 
                                                                        className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full" 
                                                                        aria-hidden="true"
                                                                    />
                                                                )}
                                                                <div className={`${sidebarOpen ? '' : 'mx-auto shrink-0'}`} aria-hidden="true">
                                                                    {item.icon}
                                                                </div>
                                                                <span className={`font-medium whitespace-nowrap text-sm ${!sidebarOpen ? 'hidden' : 'block'}`}>
                                                                    {item.label}
                                                                </span>
                                                            </Link>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </nav>

                {/* User Section */}
                <div className={`absolute bottom-0 w-full p-4 border-t ${darkMode ? 'border-slate-800' : 'border-slate-100'} ${!sidebarOpen && 'hidden'}`}>
                    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                        <div 
                            className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 ring-2 ring-white/20 flex items-center justify-center text-[10px] text-white font-bold"
                            aria-hidden="true"
                        >
                            {user?.email?.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className={`text-sm font-semibold truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                                {user?.email.split('@')[0]}
                            </p>
                            <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
                        </div>
                        <button 
                            onClick={logout}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                            aria-label="Cerrar sesión"
                            title="Cerrar sesión"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
