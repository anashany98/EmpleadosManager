import { Link, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  LogOut,
  X,
  Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { navCategories, type NavCategory, type NavItem } from './sidebarNavigation';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  darkMode: boolean;
}

export function Sidebar({ sidebarOpen, setSidebarOpen, darkMode }: SidebarProps) {
  const location = useLocation();
  const { user, logout, canAccessFeature } = useAuth();
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['empleados']);
const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setExpandedCategories([]);
      } else {
        setExpandedCategories(['empleados']);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const hasPermission = (item: NavItem): boolean => {
    if (!user) return false;
    return canAccessFeature(item.feature);
  };

  const hasVisibleItems = (category: NavCategory): boolean => category.items.some((item) => hasPermission(item));

  const isItemActive = (item: NavItem) => location.pathname === item.path;
  const isCategoryActive = (category: NavCategory) => 
    category.items.some(item => hasPermission(item) && isItemActive(item));

  return (
    <>
      <AnimatePresence>
        {sidebarOpen && isMobile && (
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
          fixed md:relative z-50 h-full transition-all duration-300 border-r flex flex-col
          ${sidebarOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full md:w-20 md:translate-x-0'}
          ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}
        `}
        role="navigation"
        aria-label="Navegacion principal"
      >
        {/* Header */}
        <div className={`p-4 border-b shrink-0 ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-3 overflow-hidden ${!sidebarOpen && 'md:hidden'}`}>
              <div className="relative w-10 h-10 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-600 to-violet-700 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 ring-1 ring-white/15">
                <div className="absolute -top-3 -right-3 h-7 w-7 rounded-full bg-white/20 blur-sm" />
                <div className="absolute bottom-0 left-0 h-4 w-full bg-black/10" />
                <div className="relative flex items-end gap-0.5" aria-hidden="true">
                  <span className="h-4 w-1.5 rounded-full bg-white/95" />
                  <span className="h-6 w-1.5 rounded-full bg-white/80" />
                  <span className="h-3 w-1.5 rounded-full bg-white/70" />
                </div>
                <span className="sr-only">RRHH Manager</span>
              </div>
              <div className="overflow-hidden">
                <span className={`font-bold text-base block truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  RRHH
                </span>
                <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Manager
                </span>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 focus:outline-none touch-active"
              aria-label="Cerrar menu"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 overflow-y-auto py-3 px-3 custom-scrollbar"
          aria-label="Menu principal"
        >
          <div className="space-y-1">
            {navCategories.map((category) => {
              if (!hasVisibleItems(category)) return null;

              const isExpanded = expandedCategories.includes(category.id);
              const isActive = isCategoryActive(category);

              return (
                <div key={category.id} className="mb-1">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                      ${isActive && !isExpanded ? 'bg-violet-50 dark:bg-violet-900/20' : ''}
                      ${isExpanded 
                        ? (darkMode ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-900')
                        : (darkMode ? 'text-slate-400 hover:bg-slate-800/50 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')
                      }
                      ${!sidebarOpen && 'md:justify-center md:px-2'}
                    `}
                    aria-expanded={isExpanded}
                    aria-controls={`category-${category.id}`}
                  >
                    <span className={`shrink-0 ${isExpanded ? 'text-violet-500' : isActive ? 'text-violet-600 dark:text-violet-400' : ''}`}>
                      {category.icon}
                    </span>
                    <span className={`flex-1 text-left truncate ${!sidebarOpen && 'md:hidden'}`}>
                      {category.label}
                    </span>
                    {category.items.length > 1 && (
                      <span className={`shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} ${!sidebarOpen && 'md:hidden'}`}>
                        <ChevronDown size={16} />
                      </span>
                    )}
                  </button>

                  {/* Submenu */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        id={`category-${category.id}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <ul className="mt-1 ml-3 pl-3 border-l space-y-0.5 border-slate-200 dark:border-slate-700" role="list">
                          {category.items.map((item) => {
                            if (!hasPermission(item)) return null;

                            const active = isItemActive(item);

                            return (
                              <li key={item.path}>
                                <Link
                                  to={item.path}
                                  onClick={() => isMobile && setSidebarOpen(false)}
                                  className={`
                                    flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150
                                    ${active 
                                      ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-semibold' 
                                      : (darkMode ? 'text-slate-500 hover:bg-slate-800/50 hover:text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')
                                    }
                                    ${!sidebarOpen && 'md:justify-center md:px-2'}
                                  `}
                                  aria-current={active ? 'page' : undefined}
                                >
                                  <span className={`shrink-0 ${active ? 'text-violet-600 dark:text-violet-400' : ''}`}>
                                    {item.icon}
                                  </span>
                                  <span className={`truncate ${!sidebarOpen && 'md:hidden'}`}>
                                    {item.label}
                                  </span>
                                  {active && (
                                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                                  )}
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
          </div>
        </nav>

        {/* Footer - Quick Action */}
        {sidebarOpen && (
          <div className={`p-3 border-t shrink-0 ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <Link
              to="/employees/new"
              onClick={() => isMobile && setSidebarOpen(false)}
              className={`
                flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold
                bg-gradient-to-r from-violet-600 to-purple-600 text-white
                hover:from-violet-700 hover:to-purple-700
                shadow-lg shadow-violet-500/25
                transition-all duration-200 active:scale-[0.98]
              `}
            >
              <Plus size={18} />
              <span>Nuevo Empleado</span>
            </Link>
          </div>
        )}

        {/* User Footer */}
        <div className={`p-3 border-t shrink-0 ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className={`flex items-center gap-3 px-2 py-2 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
            <div
              className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold"
              aria-hidden="true"
            >
              {user?.email?.substring(0, 2).toUpperCase()}
            </div>
            <div className={`flex-1 overflow-hidden ${!sidebarOpen && 'md:hidden'}`}>
              <p className={`text-sm font-semibold truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                {user?.email.split('@')[0]}
              </p>
              <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
            </div>
            <button
              onClick={logout}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors touch-active shrink-0
                ${darkMode ? 'text-slate-300 bg-red-900/20 hover:text-white hover:bg-red-700/40' : 'text-red-600 bg-red-50 hover:text-red-700 hover:bg-red-100'}
              `}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut size={16} aria-hidden="true" />
              <span className={`${!sidebarOpen && 'md:hidden'}`}>Salir</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
