import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, Package, LayoutDashboard, Inbox, Settings, X, Command } from 'lucide-react';
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

    const pages: SearchResult[] = [
        { id: 'p1', type: 'page', title: 'Dashboard', path: '/', icon: <LayoutDashboard size={18} /> },
        { id: 'p2', type: 'page', title: 'Empleados', path: '/employees', icon: <User size={18} /> },
        { id: 'p3', type: 'page', title: 'Inventario / Activos', path: '/inventory', icon: <Package size={18} /> },
        { id: 'p4', type: 'page', title: 'Bandeja de Entrada (Inbox)', path: '/inbox', icon: <Inbox size={18} /> },
        { id: 'p5', type: 'page', title: 'Configuración', path: '/settings', icon: <Settings size={18} /> },
    ];

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape') setIsOpen(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    useEffect(() => {
        const search = async () => {
            if (query.length < 2) {
                setResults(pages.filter(p => p.title.toLowerCase().includes(query.toLowerCase())));
                return;
            }

            setIsLoading(true);
            try {
                const [empRes, invRes] = await Promise.all([
                    api.get(`/employees?search=${query}`),
                    api.get(`/inventory?search=${query}`)
                ]);

                const employees = (empRes.data?.data || empRes.data || []).slice(0, 5).map((e: any) => ({
                    id: e.id,
                    type: 'employee',
                    title: `${e.firstName} ${e.lastName}`,
                    subtitle: e.dni,
                    path: `/employees/${e.id}`,
                    icon: <User size={18} className="text-blue-500" />
                }));

                const inventory = (invRes.data?.data || invRes.data || []).slice(0, 5).map((i: any) => ({
                    id: i.id,
                    type: 'inventory',
                    title: i.name,
                    subtitle: i.category,
                    path: `/inventory?q=${i.name}`,
                    icon: <Package size={18} className="text-amber-500" />
                }));

                const filteredPages = pages.filter(p => p.title.toLowerCase().includes(query.toLowerCase()));

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
        if (e.key === 'ArrowDown') {
            setSelectedIndex(prev => (prev + 1) % results.length);
        } else if (e.key === 'ArrowUp') {
            setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        } else if (e.key === 'Enter' && results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 pointer-events-none">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm pointer-events-auto"
                        onClick={() => setIsOpen(false)}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden pointer-events-auto"
                    >
                        <div className="flex items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                            <Search className="text-slate-400 mr-4" size={22} />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Escribe para buscar... (Empleados, Material, Páginas)"
                                className="flex-1 bg-transparent border-none outline-none text-lg text-slate-900 dark:text-white placeholder:text-slate-400"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={onKeyDown}
                            />
                            <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-400 text-[10px] font-black uppercase tracking-tighter">
                                <Command size={10} />
                                <span>K</span>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="ml-4 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto p-2">
                            {isLoading && results.length === 0 && (
                                <div className="py-12 text-center text-slate-400">
                                    <div className="animate-spin mb-2 mx-auto border-2 border-blue-500 border-t-transparent rounded-full w-6 h-6"></div>
                                    Buscando unidades...
                                </div>
                            )}

                            {!isLoading && query.length > 0 && results.length === 0 && (
                                <div className="py-12 text-center text-slate-400">
                                    No se han encontrado resultados para "{query}"
                                </div>
                            )}

                            {results.length > 0 && (
                                <div className="space-y-1">
                                    {results.map((result, index) => (
                                        <button
                                            key={`${result.type}-${result.id}`}
                                            className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all text-left ${selectedIndex === index
                                                    ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20'
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400'
                                                }`}
                                            onClick={() => handleSelect(result)}
                                            onMouseEnter={() => setSelectedIndex(index)}
                                        >
                                            <div className={`p-2 rounded-xl ${selectedIndex === index
                                                    ? 'bg-white dark:bg-slate-800 shadow-sm'
                                                    : 'bg-slate-100 dark:bg-slate-800/50'
                                                }`}>
                                                {result.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold truncate">{result.title}</div>
                                                {result.subtitle && (
                                                    <div className="text-xs opacity-60 truncate">{result.subtitle}</div>
                                                )}
                                            </div>
                                            <div className="text-[10px] font-black uppercase tracking-widest opacity-30">
                                                {result.type === 'page' ? 'Sección' : result.type === 'employee' ? 'Empleado' : 'Inventario'}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            <div className="flex gap-4">
                                <span className="flex items-center gap-1"><span className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded shadow-sm">↵</span> Seleccionar</span>
                                <span className="flex items-center gap-1"><span className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded shadow-sm">↑↓</span> Navegar</span>
                            </div>
                            <span>Esc para cerrar</span>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
