
import { Menu, Sun, Moon, LogOut, User, Search, Command } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import AlertCenter from './AlertCenter';
import NotificationBell from './NotificationBell';
import { navItems } from './Sidebar';
import { useConfirm } from '../context/ConfirmContext';

interface HeaderProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    darkMode: boolean;
    setDarkMode: (dark: boolean) => void;
}

export function Header({ sidebarOpen, setSidebarOpen, darkMode, setDarkMode }: HeaderProps) {
    const location = useLocation();
    const { user, logout } = useAuth();
    const confirmAction = useConfirm();

    const handleLogout = async () => {
        const confirmed = await confirmAction({
            title: 'Cerrar Sesión',
            message: '¿Estás seguro de que deseas cerrar sesión?',
            confirmText: 'Cerrar Sesión',
            cancelText: 'Cancelar',
            type: 'warning'
        });
        
        if (confirmed) {
            logout();
        }
    };

    const pageTitle = navItems.find(i => i.path === location.pathname)?.label || 'Empleados Manager APP';

    return (
        <header 
            className={`
                h-16 flex items-center justify-between px-4 md:px-6 border-b z-50 backdrop-blur-md
                ${darkMode ? 'bg-slate-950/80 border-slate-800 text-slate-100' : 'bg-white/80 border-slate-200 text-slate-800'}
            `}
            role="banner"
        >
            <div className="flex items-center gap-2 md:gap-4">
                <button 
                    onClick={() => setSidebarOpen(!sidebarOpen)} 
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
                    aria-label={sidebarOpen ? 'Cerrar menú lateral' : 'Abrir menú lateral'}
                    aria-expanded={sidebarOpen}
                    aria-controls="sidebar"
                >
                    <Menu size={20} aria-hidden="true" />
                </button>
                
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 hidden sm:block">
                    {pageTitle}
                </h2>
            </div>

            <div className="flex items-center gap-1 md:gap-3">
                {/* Command Palette Hint - Desktop only */}
                <button 
                    className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    aria-label="Abrir búsqueda rápida"
                    title="Abrir búsqueda rápida (Ctrl+K)"
                >
                    <Search size={14} aria-hidden="true" />
                    <span>Buscar...</span>
                    <kbd className="hidden xl:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-slate-200 dark:bg-slate-700 rounded">
                        <Command size={10} />K
                    </kbd>
                </button>

                {/* User Info - Desktop only */}
                <div 
                    className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-800"
                    aria-label={`Usuario actual: ${user?.email || 'Admin'}`}
                >
                    <User size={14} className="text-slate-500" aria-hidden="true" />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 max-w-[120px] truncate">
                        {user?.email || 'Admin'}
                    </span>
                </div>

                {/* Notifications */}
                <NotificationBell />

                {/* Alert Center - Admin only */}
                {(user?.role === 'admin' || (user?.permissions && user.permissions.employees !== 'none')) && (
                    <AlertCenter />
                )}

                {/* Dark Mode Toggle */}
                <button
                    onClick={() => setDarkMode(!darkMode)}
                    className={`p-2 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${
                        darkMode 
                            ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    aria-label={darkMode ? 'Activar modo claro' : 'Activar modo oscuro'}
                    title={darkMode ? 'Activar modo claro' : 'Activar modo oscuro'}
                >
                    {darkMode ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
                </button>

                {/* Logout Button */}
                <button
                    onClick={handleLogout}
                    className="p-2 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
                    title="Cerrar Sesión"
                    aria-label="Cerrar sesión"
                >
                    <LogOut size={20} aria-hidden="true" />
                </button>
            </div>
        </header>
    );
}
