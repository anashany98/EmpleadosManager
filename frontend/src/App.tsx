import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';
import { LayoutDashboard, Users, FileSpreadsheet, Settings, Moon, Sun, Menu, LogOut, CheckCircle2, Calendar as CalendarIcon, Building2, Clock } from 'lucide-react';
import PayrollImport from './pages/PayrollImport';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import EmployeeDetail from './pages/EmployeeDetail';
import CalendarPage from './pages/CalendarPage';
import Companies from './pages/Companies';
import SettingsPage from './pages/Settings';
import TimesheetPage from './pages/TimesheetPage';

function App() {
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const navItems = [
    { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: '/employees', label: 'Empleados', icon: <Users size={20} /> },
    { path: '/companies', label: 'Empresas', icon: <Building2 size={20} /> },
    { path: '/calendar', label: 'Calendario', icon: <CalendarIcon size={20} /> },
    { path: '/timesheet', label: 'Fichajes', icon: <Clock size={20} /> },
    { path: '/import', label: 'Importar Nómina', icon: <FileSpreadsheet size={20} /> },
    { path: '/settings', label: 'Configuración', icon: <Settings size={20} /> },
  ];

  return (
    <div className={`flex h-screen transition-colors duration-300 ${darkMode ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
      {/* Sidebar */}
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
        </div>

        <nav className="p-4 space-y-2 mt-4">
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
                <div className={`${sidebarOpen ? '' : 'mx-auto'}`}>{item.icon}</div>
                <span className={`font-medium ${!sidebarOpen ? 'hidden' : 'block'}`}>{item.label}</span>
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

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col relative">
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
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-full transition-all duration-300 ${darkMode ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Routes location={location} key={location.pathname}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/employees" element={<Employees />} />
                  <Route path="/employees/:id" element={<EmployeeDetail />} />
                  <Route path="/companies" element={<Companies />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/timesheet" element={<TimesheetPage />} />
                  <Route path="/import" element={<PayrollImport />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}

export default App;
