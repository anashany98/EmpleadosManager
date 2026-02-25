import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, Package, LayoutDashboard, Inbox, Settings, X, Command, FileText, Calendar, Clock, Users, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';

interface SearchResult {
    id: string;
    type: 'employee' | 'inventory' | 'page';
    title: string;
    subtitle?: string;
    path: string;
    icon: React.ReactNode;
}

export default function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const pages: SearchResult[] = [
        { id: 'p1', type: 'page', title: 'Dashboard', path: '/', icon: <LayoutDashboard size={18} />, subtitle: 'Vista general del sistema' },
        { id: 'p2', type: 'page', title: 'Empleados', path: '/employees', icon: <Users size={18} />, subtitle: 'Gestión de personal' },
        { id: 'p3', type: 'page', title: 'Calendario', path: '/calendar', icon: <Calendar size={18} />, subtitle: 'Eventos y citas' },
        { id: 'p4', type: 'page', title: 'Fichajes', path: '/timesheet', icon: <Clock size={18} />, subtitle: 'Control horario' },
        { id: 'p5', type: 'page', title: 'Inventario', path: '/assets', icon: <Package size={18} />, subtitle: 'Activos y materiales' },
        { id: 'p6', type: 'page', title: 'Bandeja de Entrada', path: '/inbox', icon: <Inbox size={18} />, subtitle: 'Documentos pendientes' },
        { id: 'p7', type: 'page', title: 'Empresas', path: '/companies', icon: <Building2 size={18} />, subtitle: 'Gestión empresarial' },
        { id: 'p8', type: 'page', title: 'Reportes', path: '/reports', icon: <FileText size={18} />, subtitle: 'Informes y estadísticas' },
        { id: 'p9', type: 'page', title: 'Configuración', path: '/settings', icon: <Settings size={18} />, subtitle: 'Ajustes del sistema' },
    ];

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setResults(pages);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Scroll selected item into view
    useEffect(() => {
        if (listRef.current) {
            const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex]);

    useEffect(() => {
        const search = async () => {
            if (query.length < 2) {
                setResults(pages.filter(p => p.title.toLowerCase().includes(query.toLowerCase())));
                return;
            }

            setIsLoading(true);
            try {
                const [empRes, invRes] = await Promise.all([
                    api.get(`/employees?search=${query}`).catch(() => ({ data: [] })),
                    api.get(`/inventory?search=${query}`).catch(() => ({ data: [] }))
                ]);

                const employees = (empRes.data?.data || empRes.data || []).slice(0, 5).map((e: any) => ({
                    id: e.id,
                    type: 'employee' as const,
                    title: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.name || 'Sin nombre',
                    subtitle: e.dni || e.department || 'Empleado',
                    path: `/employees/${e.id}`,
                    icon: <User size={18} className="text-blue-500" />
                }));

                const inventory = (invRes.data?.data || invRes.data || []).slice(0, 5).map((i: any) => ({
                    id: i.id,
                    type: 'inventory' as const,
                    title: i.name,
                    subtitle: i.category || 'Activo',
                    path: `/assets?q=${i.name}`,
                    icon: <Package size={18} className="text-amber-500" />
                }));

                const filteredPages = pages.filter(p => 
                    p.title.toLowerCase().includes(query.toLowerCase()) ||
                    p.subtitle?.toLowerCase().includes(query.toLowerCase())
                );

                setResults([...filteredPages, ...employees, ...inventory]);
            } catch (error) {
                console.error('Search failed', error);
            } finally {
                setIsLoading(false);
            }
        };

        const timer = setTimeout(search, 300);
        return () => clearTimeout(timer);
    }, [query]);

    const handleSelect = (result: SearchResult) => {
        navigate(result.path);
        setIsOpen(false);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % results.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
                break;
            case 'Enter':
                e.preventDefault();
                if (results[selectedIndex]) {
                    handleSelect(results[selectedIndex]);
                }
                break;
            case 'Home':
                e.preventDefault();
                setSelectedIndex(0);
                break;
            case 'End':
                e.preventDefault();
                setSelectedIndex(results.length - 1);
                break;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'page': return 'Sección';
            case 'employee': return 'Empleado';
            case 'inventory': return 'Inventario';
            default: return type;
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4 pointer-events-none">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm pointer-events-auto"
                        onClick={() => setIsOpen(false)}
                        aria-hidden="true"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden pointer-events-auto"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Búsqueda rápida"
                    >
                        {/* Search Input */}
                        <div className="flex items-center px-4 py-4 border-b border-slate-100 dark:border-slate-800">
                            <Search className="text-slate-400 mr-3 shrink-0" size={20} aria-hidden="true" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Buscar empleados, inventario, páginas..."
                                className="flex-1 bg-transparent border-none outline-none text-base text-slate-900 dark:text-white placeholder:text-slate-400"
                                value={query}
                                onChange={(e) => {
                                    setQuery(e.target.value);
                                    setSelectedIndex(0);
                                }}
                                onKeyDown={onKeyDown}
                                aria-label="Campo de búsqueda"
                                aria-autocomplete="list"
                                aria-controls="search-results"
                                aria-activedescendant={results[selectedIndex] ? `result-${selectedIndex}` : undefined}
                            />
                            <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-400 text-[10px] font-bold">
                                <Command size={10} />
                                K
                            </kbd>
                            <button 
                                onClick={() => setIsOpen(false)} 
                                className="ml-3 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                aria-label="Cerrar búsqueda"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Results */}
                        <div 
                            ref={listRef}
                            id="search-results"
                            className="max-h-[50vh] overflow-y-auto p-2"
                            role="listbox"
                            aria-label="Resultados de búsqueda"
                        >
                            {/* Loading State */}
                            {isLoading && results.length === 0 && (
                                <div className="py-12 text-center" role="status">
                                    <div className="animate-spin mb-3 mx-auto border-2 border-blue-500 border-t-transparent rounded-full w-8 h-8"></div>
                                    <p className="text-slate-500 dark:text-slate-400 font-medium">Buscando...</p>
                                </div>
                            )}

                            {/* Empty State */}
                            {!isLoading && query.length >= 2 && results.length === 0 && (
                                <div className="py-12 text-center">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                        <Search size={24} className="text-slate-400" />
                                    </div>
                                    <p className="text-slate-600 dark:text-slate-400 font-medium mb-1">
                                        No se encontraron resultados
                                    </p>
                                    <p className="text-sm text-slate-400 dark:text-slate-500">
                                        Intenta con otros términos de búsqueda
                                    </p>
                                </div>
                            )}

                            {/* Initial State - Quick Actions */}
                            {!isLoading && query.length < 2 && results.length > 0 && (
                                <div className="py-2">
                                    <p className="px-3 py-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                        Acciones rápidas
                                    </p>
                                </div>
                            )}

                            {/* Results List */}
                            {results.length > 0 && (
                                <div className="space-y-1">
                                    {results.map((result, index) => (
                                        <button
                                            key={`${result.type}-${result.id}`}
                                            id={`result-${index}`}
                                            data-index={index}
                                            role="option"
                                            aria-selected={selectedIndex === index}
                                            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left focus:outline-none ${
                                                selectedIndex === index
                                                    ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20'
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                                            }`}
                                            onClick={() => handleSelect(result)}
                                            onMouseEnter={() => setSelectedIndex(index)}
                                        >
                                            <div className={`p-2 rounded-lg shrink-0 ${
                                                selectedIndex === index
                                                    ? 'bg-white dark:bg-slate-800 shadow-sm'
                                                    : 'bg-slate-100 dark:bg-slate-800/50'
                                            }`}>
                                                {result.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold truncate">{result.title}</div>
                                                {result.subtitle && (
                                                    <div className="text-xs opacity-60 truncate">{result.subtitle}</div>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 shrink-0">
                                                {getTypeLabel(result.type)}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer with shortcuts */}
                        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                            <div className="flex gap-4">
                                <span className="flex items-center gap-1.5">
                                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px]">↵</kbd>
                                    <span>Seleccionar</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px]">↑↓</kbd>
                                    <span>Navegar</span>
                                </span>
                                <span className="hidden sm:flex items-center gap-1.5">
                                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px]">Esc</kbd>
                                    <span>Cerrar</span>
                                </span>
                            </div>
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <span className="flex items-center gap-1.5">
                                <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px]">Ctrl</kbd>
                                <span>+</span>
                                <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px]">K</kbd>
                                <span>para abrir</span>
                            </span>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
