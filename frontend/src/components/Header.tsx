import { Menu, Sun, Moon } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import AlertCenter from './AlertCenter';
import { navItems } from './Sidebar';

interface HeaderProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    darkMode: boolean;
    setDarkMode: (dark: boolean) => void;
}

export function Header({ sidebarOpen, setSidebarOpen, darkMode, setDarkMode }: HeaderProps) {
    const location = useLocation();

    return (
        <header className={`
          h-16 flex items-center justify-between px-6 border-b z-10 backdrop-blur-md
          ${darkMode ? 'bg-slate-950/80 border-slate-800 text-slate-100' : 'bg-white/80 border-slate-200 text-slate-800'}
        `}>
            <div className="flex items-center gap-4">
                <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <Menu size={20} />
                </button>
                <h2 className="text-lg font-semibold">
                    {navItems.find(i => i.path === location.pathname)?.label || 'NominasApp'}
                </h2>
            </div>

            <div className="flex items-center gap-4">
                <AlertCenter />
                <button
                    onClick={() => setDarkMode(!darkMode)}
                    className={`p-2 rounded-full transition-all duration-300 ${darkMode ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                    {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </div>
        </header>
    );
}
