import { useEffect } from 'react';
import { Menu, Sun, Moon, DoorOpen, User, Search, Command } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import AlertCenter from './AlertCenter';
import NotificationBell from './NotificationBell';
import { navItems } from './sidebarNavigation';
import { useConfirm } from '../context/ConfirmContext';

interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
}

const THEME_KEY = 'rrhhThemeDark';

export function getStoredTheme(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(THEME_KEY) === 'true';
}

export function Header({ sidebarOpen, setSidebarOpen, darkMode, setDarkMode }: HeaderProps) {
  const location = useLocation();
  const { user, logout, canAccessFeature } = useAuth();
  const confirmAction = useConfirm();

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored !== null) {
      setDarkMode(stored === 'true');
    }
  }, [setDarkMode]);

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
        h-14 sm:h-16 flex items-center justify-between px-3 sm:px-4 md:px-6 border-b z-50 backdrop-blur-md
        ${darkMode ? 'bg-dark-bg/80 border-dark-border text-slate-100' : 'bg-white/80 border-slate-200 text-slate-800'}
      `}
      role="banner"
    >
      <div className="flex items-center gap-2 md:gap-4 min-w-0">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2.5 sm:p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 touch-active shrink-0"
          aria-label={sidebarOpen ? 'Cerrar menú lateral' : 'Abrir menú lateral'}
          aria-expanded={sidebarOpen}
          aria-controls="sidebar"
        >
          <Menu size={20} aria-hidden="true" />
        </button>

        <h2 className="text-sm sm:text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
          {pageTitle}
        </h2>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 md:gap-3 shrink-0">
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
        {canAccessFeature('employees') && (
          <AlertCenter />
        )}

        {/* Dark Mode Toggle */}
        <button
          onClick={() => {
            const newMode = !darkMode;
            setDarkMode(newMode);
            localStorage.setItem(THEME_KEY, String(newMode));
          }}
          className={`group relative inline-flex h-9 w-[72px] items-center rounded-full border px-1 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 touch-active ${
            darkMode
              ? 'border-indigo-400/30 bg-gradient-to-r from-slate-900 to-indigo-950 shadow-inner shadow-black/30'
              : 'border-amber-200 bg-gradient-to-r from-amber-100 to-sky-100 shadow-sm shadow-amber-100/80'
          }`}
          aria-label={darkMode ? 'Activar modo claro' : 'Activar modo oscuro'}
          title={darkMode ? 'Activar modo claro' : 'Activar modo oscuro'}
        >
          <span
            className={`absolute h-7 w-7 rounded-full bg-white shadow-md transition-transform duration-300 ${
              darkMode ? 'translate-x-8' : 'translate-x-0'
            }`}
            aria-hidden="true"
          />
          <Sun size={15} className={`z-10 ml-1 transition-colors ${darkMode ? 'text-slate-500' : 'text-amber-500'}`} aria-hidden="true" />
          <Moon size={15} className={`z-10 ml-auto mr-1 transition-colors ${darkMode ? 'text-indigo-500' : 'text-slate-400'}`} aria-hidden="true" />
        </button>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="p-2 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 touch-active"
          title="Cerrar Sesión"
          aria-label="Cerrar sesión"
        >
          <DoorOpen size={18} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
