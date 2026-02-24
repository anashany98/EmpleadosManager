import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
    FileSpreadsheet, Upload, Plus, Search,
    CreditCard, Building2, MoreHorizontal, User,
    Loader2, MessageCircle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import BulkActionToolbar, { EMPLOYEE_BULK_ACTIONS } from '../components/BulkActionToolbar';
import { useConfirm } from '../context/ConfirmContext';

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

    // Client-side simple filter
    const filteredEmployees = employees.filter(emp => {
        const term = searchTerm.toLowerCase();
        const fullName = (emp.name || `${emp.firstName} ${emp.lastName}`).toLowerCase();
        return fullName.includes(term) || emp.dni.toLowerCase().includes(term);
    });

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
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Empleados</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Gestiona el maestro de empleados y sus cuentas contables</p>
                </div>
                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
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
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-3 rounded-xl font-medium shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center gap-2 transition-all w-full md:w-auto"
                    >
                        <FileSpreadsheet size={20} className="text-green-600 dark:text-green-400" />
                        <span className="truncate">Plantilla</span>
                    </button>

                    <div className="relative w-full md:w-auto">
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
                        <label htmlFor="import-employees" className={`cursor-pointer bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-3 rounded-xl font-medium shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center gap-2 transition-all w-full md:w-auto ${importMutation.isPending ? 'opacity-50 pointer-events-none' : ''}`}>
                            {importMutation.isPending ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} className="text-blue-600 dark:text-blue-400" />}
                            Importar
                        </label>
                    </div>

                    <Link to="/employees/new" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 w-full md:w-auto">
                        <Plus size={20} />
                        Nuevo
                    </Link>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col">
                {/* Filters */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o DNI..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow placeholder:text-slate-400"
                        />
                    </div>
                </div>

                {/* Table for Desktop */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-medium">
                            <tr>
                                <th className="px-6 py-4 w-12">
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-5 h-5 cursor-pointer"
                                        onChange={handleSelectAll}
                                        checked={filteredEmployees.length > 0 && selectedIds.length === filteredEmployees.length}
                                    />
                                </th>
                                <th className="px-6 py-4 w-16"></th>
                                <th className="px-6 py-4">Nombre Completo</th>
                                <th className="px-6 py-4">DNI / NIE</th>
                                <th className="px-6 py-4">Subcuenta 465</th>
                                <th className="px-6 py-4">Departamento</th>
                                <th className="px-6 py-4 text-right">Estado</th>
                                <th className="px-6 py-4 w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {isLoading ? (
                                // Skeleton Loading
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
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
                                    <tr key={emp.id} className={`group transition-colors ${selectedIds.includes(emp.id) ? 'bg-blue-50 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                        <td className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-5 h-5 cursor-pointer"
                                                checked={selectedIds.includes(emp.id)}
                                                onChange={() => handleSelectOne(emp.id)}
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shadow-inner">
                                                {(emp.name || emp.firstName || '?').charAt(0)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="font-semibold text-slate-900 dark:text-white">
                                                    <Link to={`/employees/${emp.id}`} className="hover:text-blue-600 transition-colors">
                                                        {emp.name || `${emp.firstName} ${emp.lastName}`}
                                                    </Link>
                                                </div>
                                                {emp.phone && (
                                                    <a
                                                        href={`https://api.whatsapp.com/send?phone=${emp.phone.replace(/\D/g, '').startsWith('34') ? '' : '34'}${emp.phone.replace(/\D/g, '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-1.5 bg-green-500 text-white rounded-full hover:bg-green-600 transition-all hover:scale-110 active:scale-90 shadow-sm"
                                                        title={`Contactar a ${emp.phone}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <MessageCircle size={12} />
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-xs">{emp.dni}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md w-fit font-mono text-xs">
                                                <CreditCard size={12} className="text-slate-400" />
                                                {emp.subaccount465}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                                <Building2 size={14} className="text-slate-400" />
                                                {emp.department || 'General'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${emp.active
                                                ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/30 dark:text-emerald-400'
                                                : 'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${emp.active ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                                {emp.active ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link to={`/employees/${emp.id}`} className="inline-block text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                                <MoreHorizontal size={20} />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}

                            {!isLoading && filteredEmployees.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center text-slate-400 dark:text-slate-600">
                                        <User size={48} className="mx-auto mb-4 opacity-20" />
                                        <p className="text-lg font-medium text-slate-900 dark:text-white">No se encontraron empleados</p>
                                        <p className="text-sm">Agrega uno nuevo para comenzar</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Card View for Mobile */}
                <div className="md:hidden p-4 space-y-4">
                    {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 animate-pulse h-32"></div>
                        ))
                    ) : filteredEmployees.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            <User size={40} className="mx-auto mb-3 opacity-30" />
                            <p>No se encontraron empleados</p>
                        </div>
                    ) : (
                        filteredEmployees.map((emp) => (
                            <article
                                key={emp.id}
                                className="block bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm active:scale-95 transition-all cursor-pointer"
                                role="link"
                                tabIndex={0}
                                onClick={() => navigate(`/employees/${emp.id}`)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        navigate(`/employees/${emp.id}`);
                                    }
                                }}
                            >
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg shadow-inner shrink-0">
                                        {(emp.name || emp.firstName || '?').charAt(0)}
                                    </div>
                                    <div className="min-w-0">
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
                                                className="p-2 bg-green-500 text-white rounded-full"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <MessageCircle size={14} />
                                            </a>
                                        )}
                                        <span className={`w-2 h-2 rounded-full block ${emp.active ? 'bg-emerald-500 box-shadow-emerald' : 'bg-slate-400'}`}></span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-50 dark:border-slate-800">
                                    <div className="flex items-center gap-1.5">
                                        <Building2 size={12} />
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
            </div>

            <BulkActionToolbar
                selectedCount={selectedIds.length}
                onClearSelection={() => setSelectedIds([])}
                onAction={handleBulkAction}
                actions={EMPLOYEE_BULK_ACTIONS}
            />
        </div>
    );
}
