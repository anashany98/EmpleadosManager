import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../../api/client';
import { useConfirm } from '../../../context/ConfirmContext';
import type { Employee, FilterState } from '../types';


const DEFAULT_LIMIT = 20;

interface PaginatedMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

const fetchEmployees = async (page: number, limit: number, status: string = 'active', search: string = '', department: string = ''): Promise<{ employees: Employee[]; meta: PaginatedMeta }> => {
    const params: Record<string, string | number> = { page, limit, status };
    if (search.trim()) params.search = search.trim();
    if (department.trim()) params.department = department.trim();
    const res = await api.get<{ success: boolean; data: Employee[]; meta: PaginatedMeta }>('/employees', { params });
    const employees: Employee[] = Array.isArray(res.data) ? res.data : [];
    const meta: PaginatedMeta = res.meta || { total: 0, page: 1, limit, totalPages: 1 };
    return { employees, meta };
};

export function useEmployeesPage() {
    const queryClient = useQueryClient();
    const confirmAction = useConfirm();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<FilterState>({ department: '', status: 'all' });
    const [showImportWizard, setShowImportWizard] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importBusy, setImportBusy] = useState(false);
    const [page, setPage] = useState(1);
    const [limit] = useState(DEFAULT_LIMIT);
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data, isLoading } = useQuery({
        queryKey: ['employees', page, limit, filters.status, filters.department, debouncedSearch],
        queryFn: () => fetchEmployees(page, limit, filters.status, debouncedSearch, filters.department),
        staleTime: 1000 * 60 * 5
    });

    const { data: departmentOptions = [] } = useQuery({
        queryKey: ['employee-departments'],
        queryFn: async () => {
            const response = await api.get<{ data?: string[] }>('/employees/departments');
            return Array.isArray(response.data) ? response.data : [];
        },
        staleTime: 1000 * 60 * 10
    });

    const employees = data?.employees || [];
    const paginationMeta = data?.meta || { total: 0, page: 1, limit: DEFAULT_LIMIT, totalPages: 1 };

    const bulkUpdateMutation = useMutation({
        mutationFn: async ({ employeeIds, action, data }: { employeeIds: string[]; action: string; data?: Record<string, unknown> }) => {
            const res = await api.post('/employees/bulk-update', { employeeIds, action, data });
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(data.message || 'Actualización masiva completada');
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            setSelectedIds([]);
        },
        onError: (error: unknown) => {
            toast.error(error instanceof Error ? error.message : 'Error en la actualización masiva');
        }
    });

    const departments = departmentOptions;

    const filteredEmployees = useMemo(() => {
        return employees;
    }, [employees]);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.department) count += 1;
        if (filters.status !== 'all') count += 1;
        return count;
    }, [filters]);

    const handleFiltersChange = (nextFilters: FilterState) => {
        setFilters(nextFilters);
        setPage(1);
        setSelectedIds([]);
    };

    const clearFilters = () => handleFiltersChange({ department: '', status: 'all' });

    const handleSelectAll = (checked: boolean) => {
        setSelectedIds(checked ? filteredEmployees.map((employee) => employee.id) : []);
    };

    const handleSelectOne = (employeeId: string) => {
        setSelectedIds((current) => current.includes(employeeId)
            ? current.filter((id) => id !== employeeId)
            : [...current, employeeId]);
    };

    const handleBulkAction = async (actionId: string) => {
        if (actionId === 'delete') {
            const confirmed = await confirmAction({
                title: 'Eliminación Masiva',
                message: `¿Estás seguro de eliminar ${selectedIds.length} empleados? Se marcarán como inactivos.`,
                confirmText: 'Eliminar',
                type: 'danger'
            });
            if (!confirmed) return;
        } else if (actionId === 'deactivate') {
            const confirmed = await confirmAction({
                title: 'Desactivación Masiva',
                message: `¿Desactivar a los ${selectedIds.length} empleados seleccionados?`,
                confirmText: 'Desactivar',
                type: 'warning'
            });
            if (!confirmed) return;
        } else if (actionId === 'activate') {
            const confirmed = await confirmAction({
                title: 'Activación Masiva',
                message: `¿Activar a los ${selectedIds.length} empleados seleccionados?`,
                confirmText: 'Activar',
                type: 'info'
            });
            if (!confirmed) return;
        }

        if (actionId === 'change_dept') {
            const nextDepartment = prompt('Escribe el nombre del nuevo departamento:');
            if (!nextDepartment) return;
            bulkUpdateMutation.mutate({ employeeIds: selectedIds, action: actionId, data: { department: nextDepartment } });
            return;
        }

        bulkUpdateMutation.mutate({ employeeIds: selectedIds, action: actionId });
    };

    const handleDownloadTemplate = async () => {
        try {
            const blob = await api.get('/employees/template', { responseType: 'blob' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'plantilla_empleados_avanzada.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch {
            toast.error('Error al descargar la plantilla');
        }
    };

    const handleImportFile = (file: File) => {
        setImportFile(file);
        setShowImportWizard(true);
    };

    const handleCloseImportWizard = () => {
        setShowImportWizard(false);
        setImportFile(null);
        setImportBusy(false);
    };

    const handleImportCompleted = () => {
        queryClient.invalidateQueries({ queryKey: ['employees'] });
        setShowImportWizard(false);
        setImportFile(null);
        setImportBusy(false);
    };

    return {
        employees,
        paginationMeta,
        isLoading,
        searchTerm,
        selectedIds,
        showFilters,
        filters,
        departments,
        filteredEmployees,
        activeFilterCount,
        importFile,
        showImportWizard,
        importBusy,
        setSearchTerm,
        setShowFilters,
        setFilters: handleFiltersChange,
        setSelectedIds,
        setImportBusy,
        clearFilters,
        handleSelectAll,
        handleSelectOne,
        handleBulkAction,
        handleDownloadTemplate,
        handleImportFile,
        handleCloseImportWizard,
        handleImportCompleted,
        setPage
    };
}
