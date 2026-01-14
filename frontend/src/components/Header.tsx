
import { Menu, Sun, Moon, LogOut, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import AlertCenter from './AlertCenter';
import NotificationBell from './NotificationBell';
import { navItems } from './Sidebar';

interface HeaderProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    darkMode: boolean;
    setDarkMode: (dark: boolean) => void;
}

export function Header({ sidebarOpen, setSidebarOpen, darkMode, setDarkMode }: HeaderProps) {
    const location = useLocation();
    const { user, logout } = useAuth();

    return (
        <header className={`
          h-16 flex items-center justify-between px-6 border-b z-50 backdrop-blur-md
          ${darkMode ? 'bg-slate-950/80 border-slate-800 text-slate-100' : 'bg-white/80 border-slate-200 text-slate-800'}
        `}>
            <div className="flex items-center gap-4">
                <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <Menu size={20} />
                </button>
                <h2 className="text-lg font-semibold">
                    {navItems.find(i => i.path === location.pathname)?.label || 'Empleados Manager APP'}
                </h2>
            </div>

            <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-800">
                    <User size={14} className="text-slate-500" />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{user?.email || 'Admin'}</span>
                </div>

                <NotificationBell />

                {(user?.role === 'admin' || (user?.permissions && user.permissions.employees !== 'none')) && (
                    <AlertCenter />
                )}
                <button
                    onClick={() => setDarkMode(!darkMode)}
                    className={`p-2 rounded-full transition-all duration-300 ${darkMode ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                    {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                <button
                    onClick={() => {
                        if (confirm('¿Cerrar sesión?')) {
                            logout();
                        }
                    }}
                    className="p-2 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all"
                    title="Cerrar Sesión"
                >
                    <LogOut size={20} />
                </button>
            </div>
        </header>
    );
}
