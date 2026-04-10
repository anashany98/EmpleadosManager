import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../../api/client';
import { useConfirm } from '../../../context/ConfirmContext';
import type { Employee, FilterState } from '../types';

const fetchEmployees = async (): Promise<Employee[]> => {
    const res = await api.get('/employees');
    const data = res.data?.data || res.data || [];
    return Array.isArray(data) ? data : [];
};

export function useEmployeesPage() {
    const queryClient = useQueryClient();
    const confirmAction = useConfirm();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<FilterState>({ department: '', status: 'all' });

    const { data: employees = [], isLoading } = useQuery({
        queryKey: ['employees'],
        queryFn: fetchEmployees,
        staleTime: 1000 * 60 * 5
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

    const departments = useMemo(() => {
        const values = new Set(employees.map((employee) => employee.department || 'General'));
        return Array.from(values).sort();
    }, [employees]);

    const filteredEmployees = useMemo(() => {
        return employees.filter((employee) => {
            const term = searchTerm.toLowerCase();
            const fullName = (employee.name || `${employee.firstName} ${employee.lastName}`).toLowerCase();
            const matchesSearch = fullName.includes(term) || employee.dni.toLowerCase().includes(term);
            const matchesDepartment = !filters.department || (employee.department || 'General') === filters.department;
            const matchesStatus = filters.status === 'all'
                || (filters.status === 'active' && employee.active)
                || (filters.status === 'inactive' && !employee.active);

            return matchesSearch && matchesDepartment && matchesStatus;
        });
    }, [employees, filters, searchTerm]);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.department) count += 1;
        if (filters.status !== 'all') count += 1;
        return count;
    }, [filters]);

    const clearFilters = () => setFilters({ department: '', status: 'all' });

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
        const promise = importMutation.mutateAsync(file);
        toast.promise(promise, {
            loading: 'Importando empleados...',
            success: 'Proceso finalizado',
            error: 'Error al importar'
        });
    };

    return {
        employees,
        isLoading,
        searchTerm,
        selectedIds,
        showFilters,
        filters,
        departments,
        filteredEmployees,
        activeFilterCount,
        importMutation,
        setSearchTerm,
        setShowFilters,
        setFilters,
        setSelectedIds,
        clearFilters,
        handleSelectAll,
        handleSelectOne,
        handleBulkAction,
        handleDownloadTemplate,
        handleImportFile
    };
}
