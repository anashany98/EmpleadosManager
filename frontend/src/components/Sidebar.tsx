import { Link, useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard, Users, Network, Building2, Calendar as CalendarIcon, Clock, Package, History, FileText, FileSpreadsheet, Settings, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    darkMode: boolean;
}

export const navItems = [
    { path: '/', label: 'BI Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: '/dashboard/employees', label: 'Dashboard RR.HH', icon: <BarChart3 size={20} /> },
    { path: '/employees', label: 'Empleados', icon: <Users size={20} /> },
    { path: '/employees/org-chart', label: 'Organigrama', icon: <Network size={20} /> },
    { path: '/companies', label: 'Empresas', icon: <Building2 size={20} /> },
    { path: '/calendar', label: 'Calendario', icon: <CalendarIcon size={20} /> },
    { path: '/timesheet', label: 'Fichajes', icon: <Clock size={20} /> },
    { path: '/assets', label: 'Inventario', icon: <Package size={20} /> },
    { path: '/audit', label: 'Auditoría', icon: <History size={20} /> },
    { path: '/reports', label: 'Reportes', icon: <FileText size={20} /> },
    { path: '/import', label: 'Importar Nómina', icon: <FileSpreadsheet size={20} /> },
    { path: '/settings', label: 'Configuración', icon: <Settings size={20} /> },
];

export function Sidebar({ sidebarOpen, setSidebarOpen, darkMode }: SidebarProps) {
    const location = useLocation();

    return (
        <>
            <AnimatePresence>
                {sidebarOpen && window.innerWidth <= 768 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSidebarOpen(false)}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-10 md:hidden"
                    />
                )}
            </AnimatePresence>

            <aside className={`
                fixed md:relative z-20 h-full transition-all duration-300 border-r 
                ${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full md:w-20 md:translate-x-0'}
                ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}
            `}>
                <div className={`p-6 border-b flex items-center justify-between ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    <div className={`font-bold text-xl flex items-center gap-2 overflow-hidden whitespace-nowrap ${!sidebarOpen && 'md:hidden'}`}>
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                            N
                        </div>
                        <span className={darkMode ? 'text-white' : 'text-slate-900'}>NominasApp</span>
                    </div>
                    <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 text-slate-400">
                        <LogOut size={20} className="rotate-180" />
                    </button>
                </div>

                <nav className="p-4 space-y-1 mt-4 h-[calc(100vh-160px)] overflow-y-auto custom-scrollbar">
                    {navItems.map((item) => {
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
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 ring-2 ring-white/20"></div>
                        <div className="flex-1 overflow-hidden">
                            <p className={`text-sm font-semibold truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>Usuario Demo</p>
                            <p className="text-xs text-slate-500">Administrador</p>
                        </div>
                        <LogOut size={16} className="text-slate-400 hover:text-red-400 cursor-pointer" />
                    </div>
                </div>
            </aside>
        </>
    );
}
