import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
    FileSpreadsheet, Upload, Plus, Search,
    CreditCard, Building2, MoreHorizontal, User,
    Loader2, MessageCircle, Filter, X, ChevronDown, Users, UserCheck, UserX
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import BulkActionToolbar, { EMPLOYEE_BULK_ACTIONS } from '../components/BulkActionToolbar';
import { useConfirm } from '../context/ConfirmContext';
import { motion, AnimatePresence } from 'framer-motion';

// Type helper (would normally be in types/employee.ts)
interface Employee {
    id: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    dni: string;
    subaccount465: string;
    department?: string;
    phone?: string;
    active: boolean;
}

// Filter state interface
interface FilterState {
    department: string;
    status: 'all' | 'active' | 'inactive';
}

const fetchEmployees = async (): Promise<Employee[]> => {
    const res = await api.get('/employees');
    const data = res.data?.data || res.data || [];
    return Array.isArray(data) ? data : [];
};

export default function EmployeeList() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const confirmAction = useConfirm();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<FilterState>({
        department: '',
        status: 'all'
    });

    const { data: employees = [], isLoading } = useQuery({
        queryKey: ['employees'],
        queryFn: fetchEmployees,
        staleTime: 1000 * 60 * 5 // 5 minutes
    });

    const importMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/employees/import', formData);
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(data.message || 'Importación completada');
            queryClient.invalidateQueries({ queryKey: ['employees'] });
        },
        onError: () => {
            toast.error('Error en la importación');
        }
    });

    const bulkUpdateMutation = useMutation({
        mutationFn: async ({ employeeIds, action, data }: { employeeIds: string[], action: string, data?: any }) => {
            const res = await api.post('/employees/bulk-update', { employeeIds, action, data });
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(data.message || 'Actualización masiva completada');
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            setSelectedIds([]);
        },
        onError: (err: any) => {
            toast.error(err.message || 'Error en la actualización masiva');
        }
    });

    // Get unique departments for filter
    const departments = useMemo(() => {
        const depts = new Set(employees.map(e => e.department || 'General'));
        return Array.from(depts).sort();
    }, [employees]);

    // Apply filters and search
    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            // Search filter
            const term = searchTerm.toLowerCase();
            const fullName = (emp.name || `${emp.firstName} ${emp.lastName}`).toLowerCase();
            const matchesSearch = fullName.includes(term) || emp.dni.toLowerCase().includes(term);

            // Department filter
            const matchesDepartment = !filters.department || (emp.department || 'General') === filters.department;

            // Status filter
            const matchesStatus = filters.status === 'all' || 
                (filters.status === 'active' && emp.active) ||
                (filters.status === 'inactive' && !emp.active);

            return matchesSearch && matchesDepartment && matchesStatus;
        });
    }, [employees, searchTerm, filters]);

    // Count active filters
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.department) count++;
        if (filters.status !== 'all') count++;
        return count;
    }, [filters]);

    const clearFilters = () => {
        setFilters({ department: '', status: 'all' });
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(filteredEmployees.map(emp => emp.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleBulkAction = async (actionId: string) => {
        if (actionId === 'delete') {
            const ok = await confirmAction({
                title: 'Eliminación Masiva',
                message: `¿Estás seguro de eliminar ${selectedIds.length} empleados? Se marcarán como inactivos.`,
                confirmText: 'Eliminar',
                type: 'danger'
            });
            if (!ok) return;
        } else if (actionId === 'deactivate') {
            const ok = await confirmAction({
                title: 'Desactivación Masiva',
                message: `¿Desactivar a los ${selectedIds.length} empleados seleccionados?`,
                confirmText: 'Desactivar',
                type: 'warning'
            });
            if (!ok) return;
        } else if (actionId === 'activate') {
            const ok = await confirmAction({
                title: 'Activación Masiva',
                message: `¿Activar a los ${selectedIds.length} empleados seleccionados?`,
                confirmText: 'Activar',
                type: 'info'
            });
            if (!ok) return;
        }

        if (actionId === 'change_dept') {
            const newDept = prompt('Escribe el nombre del nuevo departamento:');
            if (!newDept) return;
            bulkUpdateMutation.mutate({ employeeIds: selectedIds, action: actionId, data: { department: newDept } });
            return;
        }

        bulkUpdateMutation.mutate({ employeeIds: selectedIds, action: actionId });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                            Empleados
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm md:text-base">
                            Gestiona el maestro de empleados y sus cuentas contables
                        </p>
                    </div>
                    
                    {/* Action Buttons - Consistent Hierarchy */}
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        {/* Tertiary Action - Ghost */}
                        <button
                            onClick={async () => {
                                try {
                                    const blob = await api.get('/employees/template', { responseType: 'blob' });
                                    const url = window.URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.setAttribute('download', 'plantilla_empleados_avanzada.xlsx');
                                    document.body.appendChild(link);
                                    link.click();
                                    link.remove();
                                } catch (err) {
                                    toast.error('Error al descargar la plantilla');
                                }
                            }}
                            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            aria-label="Descargar plantilla de empleados"
                        >
                            <FileSpreadsheet size={18} className="text-green-600 dark:text-green-400" />
                            <span className="hidden sm:inline">Plantilla</span>
                        </button>

                        {/* Secondary Action - Outline */}
                        <div className="relative">
                            <input
                                type="file"
                                id="import-employees"
                                className="hidden"
                                accept=".xlsx, .xls, .csv"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        const promise = importMutation.mutateAsync(e.target.files[0]);
                                        toast.promise(promise, {
                                            loading: 'Importando empleados...',
                                            success: 'Proceso finalizado',
                                            error: 'Error al importar'
                                        });
                                    }
                                }}
                            />
                            <label 
                                htmlFor="import-employees" 
                                className={`cursor-pointer border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all focus-within:ring-2 focus-within:ring-blue-500 ${importMutation.isPending ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                {importMutation.isPending ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <Upload size={18} className="text-blue-600 dark:text-blue-400" />
                                )}
                                <span>Importar</span>
                            </label>
                        </div>

                        {/* Primary Action - Solid */}
                        <Link 
                            to="/employees/new" 
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                        >
                            <Plus size={18} />
                            <span>Nuevo Empleado</span>
                        </Link>
                    </div>
                </div>

                {/* Stats Summary */}
                <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <Users size={16} />
                        <span>{employees.length} total</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <UserCheck size={16} />
                        <span>{employees.filter(e => e.active).length} activos</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                        <UserX size={16} />
                        <span>{employees.filter(e => !e.active).length} inactivos</span>
                    </div>
                </div>
            </div>

            {/* Main Content Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col">
                {/* Search and Filters */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                    <div className="flex flex-col sm:flex-row gap-3">
                        {/* Search Input */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por nombre o DNI..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow placeholder:text-slate-400"
                                aria-label="Buscar empleados"
                            />
                        </div>

                        {/* Filter Toggle Button */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                activeFilterCount > 0
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                            aria-expanded={showFilters}
                            aria-controls="filter-panel"
                        >
                            <Filter size={18} />
                            <span>Filtros</span>
                            {activeFilterCount > 0 && (
                                <span className="bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                                    {activeFilterCount}
                                </span>
                            )}
                            <ChevronDown size={16} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                        </button>
                    </div>

                    {/* Filter Panel */}
                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                id="filter-panel"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <div className="flex flex-wrap items-end gap-4 pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                                    {/* Department Filter */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                            Departamento
                                        </label>
                                        <select
                                            value={filters.department}
                                            onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
                                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        >
                                            <option value="">Todos</option>
                                            {departments.map(dept => (
                                                <option key={dept} value={dept}>{dept}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Status Filter */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                            Estado
                                        </label>
                                        <select
                                            value={filters.status}
                                            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as FilterState['status'] }))}
                                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        >
                                            <option value="all">Todos</option>
                                            <option value="active">Activos</option>
                                            <option value="inactive">Inactivos</option>
                                        </select>
                                    </div>

                                    {/* Clear Filters */}
                                    {activeFilterCount > 0 && (
                                        <button
                                            onClick={clearFilters}
                                            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                                        >
                                            <X size={14} />
                                            Limpiar filtros
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Active Filter Chips */}
                    {activeFilterCount > 0 && !showFilters && (
                        <div className="flex flex-wrap gap-2 mt-3">
                            {filters.department && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium">
                                    {filters.department}
                                    <button
                                        onClick={() => setFilters(prev => ({ ...prev, department: '' }))}
                                        className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                                        aria-label={`Quitar filtro de departamento ${filters.department}`}
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            )}
                            {filters.status !== 'all' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium">
                                    {filters.status === 'active' ? 'Activos' : 'Inactivos'}
                                    <button
                                        onClick={() => setFilters(prev => ({ ...prev, status: 'all' }))}
                                        className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                                        aria-label={`Quitar filtro de estado`}
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Selection Counter */}
                {selectedIds.length > 0 && (
                    <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/30 flex items-center gap-2">
                        <span className="text-sm text-blue-700 dark:text-blue-400 font-medium">
                            {selectedIds.length} de {filteredEmployees.length} seleccionados
                        </span>
                        <button
                            onClick={() => setSelectedIds([])}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                            Limpiar selección
                        </button>
                    </div>
                )}

                {/* Table for Desktop */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-sm" role="grid">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-medium">
                            <tr>
                                <th className="px-6 py-4 w-12" scope="col">
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                            onChange={handleSelectAll}
                                            checked={filteredEmployees.length > 0 && selectedIds.length === filteredEmployees.length}
                                            aria-label="Seleccionar todos los empleados"
                                        />
                                    </label>
                                </th>
                                <th className="px-6 py-4 w-16" scope="col"></th>
                                <th className="px-6 py-4" scope="col">Nombre Completo</th>
                                <th className="px-6 py-4" scope="col">DNI / NIE</th>
                                <th className="px-6 py-4" scope="col">Subcuenta 465</th>
                                <th className="px-6 py-4" scope="col">Departamento</th>
                                <th className="px-6 py-4 text-right" scope="col">Estado</th>
                                <th className="px-6 py-4 w-12" scope="col">
                                    <span className="sr-only">Acciones</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {isLoading ? (
                                // Skeleton Loading
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse" aria-hidden="true">
                                        <td className="px-6 py-4"><div className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-700"></div></td>
                                        <td className="px-6 py-4"><div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
                                        <td className="px-6 py-4 text-right"><div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded-full inline-block"></div></td>
                                        <td className="px-6 py-4"></td>
                                    </tr>
                                ))
                            ) : (
                                filteredEmployees.map((emp) => (
                                    <tr 
                                        key={emp.id} 
                                        className={`group transition-colors ${selectedIds.includes(emp.id) ? 'bg-blue-50 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                    >
                                        <td className="px-6 py-4">
                                            <label className="flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                                    checked={selectedIds.includes(emp.id)}
                                                    onChange={() => handleSelectOne(emp.id)}
                                                    aria-label={`Seleccionar ${emp.name || `${emp.firstName} ${emp.lastName}`}`}
                                                />
                                            </label>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shadow-inner" aria-hidden="true">
                                                {(emp.name || emp.firstName || '?').charAt(0)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="font-semibold text-slate-900 dark:text-white">
                                                    <Link 
                                                        to={`/employees/${emp.id}`} 
                                                        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus-visible:underline"
                                                    >
                                                        {emp.name || `${emp.firstName} ${emp.lastName}`}
                                                    </Link>
                                                </div>
                                                {emp.phone && (
                                                    <a
                                                        href={`https://api.whatsapp.com/send?phone=${emp.phone.replace(/\D/g, '').startsWith('34') ? '' : '34'}${emp.phone.replace(/\D/g, '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-1.5 bg-green-500 text-white rounded-full hover:bg-green-600 transition-all hover:scale-110 active:scale-90 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                                                        title={`Contactar por WhatsApp a ${emp.phone}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        aria-label={`Contactar por WhatsApp a ${emp.name || `${emp.firstName} ${emp.lastName}`}`}
                                                    >
                                                        <MessageCircle size={12} aria-hidden="true" />
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-xs">{emp.dni}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md w-fit font-mono text-xs">
                                                <CreditCard size={12} className="text-slate-400" aria-hidden="true" />
                                                {emp.subaccount465}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                                <Building2 size={14} className="text-slate-400" aria-hidden="true" />
                                                {emp.department || 'General'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${emp.active
                                                ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/30 dark:text-emerald-400'
                                                : 'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${emp.active ? 'bg-emerald-500' : 'bg-slate-400'}`} aria-hidden="true"></span>
                                                {emp.active ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link 
                                                to={`/employees/${emp.id}`} 
                                                className="inline-block text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                                aria-label={`Ver detalles de ${emp.name || `${emp.firstName} ${emp.lastName}`}`}
                                            >
                                                <MoreHorizontal size={20} aria-hidden="true" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}

                            {!isLoading && filteredEmployees.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-16 text-center">
                                        <div className="max-w-sm mx-auto">
                                            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                                <User size={32} className="text-slate-400 dark:text-slate-500" aria-hidden="true" />
                                            </div>
                                            <p className="text-lg font-medium text-slate-900 dark:text-white mb-1">
                                                No se encontraron empleados
                                            </p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                                {searchTerm || activeFilterCount > 0
                                                    ? 'Intenta ajustar los filtros de búsqueda'
                                                    : 'Agrega un nuevo empleado para comenzar'
                                                }
                                            </p>
                                            {!searchTerm && activeFilterCount === 0 && (
                                                <Link 
                                                    to="/employees/new"
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                                                >
                                                    <Plus size={16} />
                                                    Agregar empleado
                                                </Link>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Card View for Mobile */}
                <div className="md:hidden p-4 space-y-3" role="list" aria-label="Lista de empleados">
                    {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 animate-pulse h-32" aria-hidden="true"></div>
                        ))
                    ) : filteredEmployees.length === 0 ? (
                        <div className="text-center py-10">
                            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                <User size={24} className="text-slate-400" aria-hidden="true" />
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 font-medium">No se encontraron empleados</p>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                                {searchTerm || activeFilterCount > 0
                                    ? 'Ajusta los filtros para ver más resultados'
                                    : 'Toca el botón + para agregar uno nuevo'
                                }
                            </p>
                        </div>
                    ) : (
                        filteredEmployees.map((emp) => (
                            <article
                                key={emp.id}
                                className="block bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                role="listitem"
                                tabIndex={0}
                                onClick={() => navigate(`/employees/${emp.id}`)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        navigate(`/employees/${emp.id}`);
                                    }
                                }}
                                aria-label={`${emp.name || `${emp.firstName} ${emp.lastName}`}, ${emp.department || 'General'}, ${emp.active ? 'Activo' : 'Inactivo'}`}
                            >
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg shadow-inner shrink-0" aria-hidden="true">
                                        {(emp.name || emp.firstName || '?').charAt(0)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-bold text-slate-900 dark:text-white truncate">
                                            {emp.name || `${emp.firstName} ${emp.lastName}`}
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                                            {emp.dni}
                                        </p>
                                    </div>
                                    <div className="ml-auto flex items-center gap-2">
                                        {emp.phone && (
                                            <a
                                                href={`https://api.whatsapp.com/send?phone=${emp.phone.replace(/\D/g, '').startsWith('34') ? '' : '34'}${emp.phone.replace(/\D/g, '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
                                                onClick={(e) => e.stopPropagation()}
                                                aria-label="Contactar por WhatsApp"
                                            >
                                                <MessageCircle size={14} aria-hidden="true" />
                                            </a>
                                        )}
                                        <span className={`w-2.5 h-2.5 rounded-full block ${emp.active ? 'bg-emerald-500' : 'bg-slate-400'}`} aria-hidden="true"></span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-50 dark:border-slate-800">
                                    <div className="flex items-center gap-1.5">
                                        <Building2 size={12} aria-hidden="true" />
                                        {emp.department || 'General'}
                                    </div>
                                    <div className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                        {emp.subaccount465}
                                    </div>
                                </div>
                            </article>
                        ))
                    )}
                </div>

                {/* Results count footer */}
                {!isLoading && filteredEmployees.length > 0 && (
                    <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
                        Mostrando {filteredEmployees.length} de {employees.length} empleados
                    </div>
                )}
            </div>

            <BulkActionToolbar
                selectedCount={selectedIds.length}
                totalCount={filteredEmployees.length}
                onClearSelection={() => setSelectedIds([])}
                onAction={handleBulkAction}
                actions={EMPLOYEE_BULK_ACTIONS}
                entityName="empleados"
            />
        </div>
    );
}
