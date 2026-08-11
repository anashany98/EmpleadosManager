import { useMemo } from 'react';
import { EmployeesBulkPanel } from '../features/employees/components/EmployeesBulkPanel';
import { EmployeesFilters } from '../features/employees/components/EmployeesFilters';
import { EmployeesHeader } from '../features/employees/components/EmployeesHeader';
import { EmployeeImportWizard } from '../features/employees/components/EmployeeImportWizard';
import { EmployeesMobileList } from '../features/employees/components/EmployeesMobileList';
import { EmployeesSelectionBar } from '../features/employees/components/EmployeesSelectionBar';
import { EmployeesTable } from '../features/employees/components/EmployeesTable';
import { useEmployeesPage } from '../features/employees/hooks/useEmployeesPage';
import { EmployeeDeactivationDialog } from '../features/employees/components/EmployeeDeactivationDialog';

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
                importPending={page.importBusy}
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
                    totalEmployees={page.paginationMeta.total}
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

                {!page.isLoading && (
                    <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                            Mostrando {page.employees.length} de {page.paginationMeta.total} empleados
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => page.setPage(p => Math.max(1, p - 1))}
                                disabled={page.paginationMeta.page <= 1}
                                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                Anterior
                            </button>
                            <span className="text-sm text-slate-600 dark:text-slate-300">
                                Página {page.paginationMeta.page} de {page.paginationMeta.totalPages || 1}
                            </span>
                            <button
                                onClick={() => page.setPage(p => Math.min(page.paginationMeta.totalPages, p + 1))}
                                disabled={page.paginationMeta.page >= page.paginationMeta.totalPages}
                                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <EmployeesBulkPanel
                selectedCount={page.selectedIds.length}
                totalCount={page.filteredEmployees.length}
                onClearSelection={() => page.setSelectedIds([])}
                onAction={page.handleBulkAction}
            />

            <EmployeeImportWizard
                isOpen={page.showImportWizard}
                file={page.importFile}
                onClose={page.handleCloseImportWizard}
                onImported={page.handleImportCompleted}
                onBusyChange={page.setImportBusy}
            />

            <EmployeeDeactivationDialog
                open={page.showDeactivationDialog}
                employeeCount={page.selectedIds.length}
                busy={page.deactivationBusy}
                onClose={() => page.setShowDeactivationDialog(false)}
                onConfirm={page.handleConfirmDeactivation}
            />
        </div>
    );
}
