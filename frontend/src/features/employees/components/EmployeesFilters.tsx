import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Filter, Search, X } from 'lucide-react';
import type { FilterState } from '../types';

interface EmployeesFiltersProps {
    searchTerm: string;
    showFilters: boolean;
    filters: FilterState;
    departments: string[];
    activeFilterCount: number;
    onSearchChange: (value: string) => void;
    onToggleFilters: () => void;
    onFiltersChange: (filters: FilterState) => void;
    onClearFilters: () => void;
}

export function EmployeesFilters(props: EmployeesFiltersProps) {
    return (
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o DNI..."
                        value={props.searchTerm}
                        onChange={(event) => props.onSearchChange(event.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow placeholder:text-slate-400"
                        aria-label="Buscar empleados"
                    />
                </div>

                <button
                    onClick={props.onToggleFilters}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${props.activeFilterCount > 0 ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    aria-expanded={props.showFilters}
                    aria-controls="filter-panel"
                >
                    <Filter size={18} />
                    <span>Filtros</span>
                    {props.activeFilterCount > 0 && (
                        <span className="bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{props.activeFilterCount}</span>
                    )}
                    <ChevronDown size={16} className={`transition-transform ${props.showFilters ? 'rotate-180' : ''}`} />
                </button>
            </div>

            <AnimatePresence>
                {props.showFilters && (
                    <motion.div
                        id="filter-panel"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="flex flex-wrap items-end gap-4 pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Departamento</label>
                                <select
                                    value={props.filters.department}
                                    onChange={(event) => props.onFiltersChange({ ...props.filters, department: event.target.value })}
                                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                >
                                    <option value="">Todos</option>
                                    {props.departments.map((department) => (
                                        <option key={department} value={department}>{department}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Estado</label>
                                <select
                                    value={props.filters.status}
                                    onChange={(event) => props.onFiltersChange({ ...props.filters, status: event.target.value as FilterState['status'] })}
                                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                >
                                    <option value="all">Todos</option>
                                    <option value="active">Activos</option>
                                    <option value="inactive">Inactivos</option>
                                </select>
                            </div>

                            {props.activeFilterCount > 0 && (
                                <button onClick={props.onClearFilters} className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors">
                                    <X size={14} />
                                    Limpiar filtros
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {props.activeFilterCount > 0 && !props.showFilters && (
                <div className="flex flex-wrap gap-2 mt-3">
                    {props.filters.department && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium">
                            {props.filters.department}
                            <button onClick={() => props.onFiltersChange({ ...props.filters, department: '' })} className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5" aria-label={`Quitar filtro de departamento ${props.filters.department}`}>
                                <X size={12} />
                            </button>
                        </span>
                    )}
                    {props.filters.status !== 'all' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium">
                            {props.filters.status === 'active' ? 'Activos' : 'Inactivos'}
                            <button onClick={() => props.onFiltersChange({ ...props.filters, status: 'all' })} className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5" aria-label="Quitar filtro de estado">
                                <X size={12} />
                            </button>
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
