import { useMemo } from 'react';
import { EmployeesBulkPanel } from '../features/employees/components/EmployeesBulkPanel';
import { EmployeesFilters } from '../features/employees/components/EmployeesFilters';
import { EmployeesHeader } from '../features/employees/components/EmployeesHeader';
import { EmployeesMobileList } from '../features/employees/components/EmployeesMobileList';
import { EmployeesSelectionBar } from '../features/employees/components/EmployeesSelectionBar';
import { EmployeesTable } from '../features/employees/components/EmployeesTable';
import { useEmployeesPage } from '../features/employees/hooks/useEmployeesPage';

export default function EmployeeList() {
    const page = useEmployeesPage();

    const stats = useMemo(() => ({
        total: page.employees.length,
        active: page.employees.filter((employee) => employee.active).length,
        inactive: page.employees.filter((employee) => !employee.active).length
    }), [page.employees]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <EmployeesHeader
                total={stats.total}
                active={stats.active}
                inactive={stats.inactive}
                importPending={page.importMutation.isPending}
                onDownloadTemplate={page.handleDownloadTemplate}
                onImportFile={page.handleImportFile}
            />

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col">
                <EmployeesFilters
                    searchTerm={page.searchTerm}
                    showFilters={page.showFilters}
                    filters={page.filters}
                    departments={page.departments}
                    activeFilterCount={page.activeFilterCount}
                    onSearchChange={page.setSearchTerm}
                    onToggleFilters={() => page.setShowFilters(!page.showFilters)}
                    onFiltersChange={page.setFilters}
                    onClearFilters={page.clearFilters}
                />

                <EmployeesSelectionBar
                    selectedCount={page.selectedIds.length}
                    filteredCount={page.filteredEmployees.length}
                    onClearSelection={() => page.setSelectedIds([])}
                />

                <EmployeesTable
                    employees={page.filteredEmployees}
                    isLoading={page.isLoading}
                    selectedIds={page.selectedIds}
                    totalEmployees={page.employees.length}
                    searchTerm={page.searchTerm}
                    activeFilterCount={page.activeFilterCount}
                    onSelectAll={page.handleSelectAll}
                    onSelectOne={page.handleSelectOne}
                />

                <EmployeesMobileList
                    employees={page.filteredEmployees}
                    isLoading={page.isLoading}
                    searchTerm={page.searchTerm}
                    activeFilterCount={page.activeFilterCount}
                />

                {!page.isLoading && page.filteredEmployees.length > 0 && (
                    <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
                        Mostrando {page.filteredEmployees.length} de {page.employees.length} empleados
                    </div>
                )}
            </div>

            <EmployeesBulkPanel
                selectedCount={page.selectedIds.length}
                totalCount={page.filteredEmployees.length}
                onClearSelection={() => page.setSelectedIds([])}
                onAction={page.handleBulkAction}
            />
        </div>
    );
}
