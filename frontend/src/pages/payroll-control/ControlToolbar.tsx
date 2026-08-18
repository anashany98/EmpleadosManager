import { Search, Filter } from 'lucide-react';

type GroupBy = 'DEPARTMENT' | 'CATEGORY';
type ColumnPreset = 'ESSENTIAL' | 'ALL';
type GestoriaStatusFilter = 'ALL' | 'ERROR' | 'READY' | 'WITH_VALUES';

interface ControlToolbarProps {
    controlModalOpen: boolean;
    filterText: string;
    onFilterTextChange: (value: string) => void;
    selectedDept: string;
    onDeptChange: (value: string) => void;
    departments: string[];
    recordsLength: number;
    activeView: 'CONTROL' | 'GESTORIA';
    groupBy: GroupBy;
    onGroupByChange: (value: GroupBy) => void;
    columnPreset: ColumnPreset;
    onColumnPresetChange: (value: ColumnPreset) => void;
    gestoriaStatusFilter: GestoriaStatusFilter;
    onGestoriaStatusFilterChange: (value: GestoriaStatusFilter) => void;
}

export default function ControlToolbar({
    controlModalOpen, filterText, onFilterTextChange,
    selectedDept, onDeptChange, departments, recordsLength, activeView,
    groupBy, onGroupByChange, columnPreset, onColumnPresetChange,
    gestoriaStatusFilter, onGestoriaStatusFilterChange
}: ControlToolbarProps) {
    return (
        <div id="payroll-control-table" className={`flex scroll-mt-4 flex-col sm:flex-row items-center justify-between gap-4 ${controlModalOpen ? 'shrink-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900' : ''}`}>
            <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                    type="text"
                    value={filterText}
                    onChange={(e) => onFilterTextChange(e.target.value)}
                    placeholder="Buscar por empleado..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <Filter size={16} className="text-slate-400" />
                <select
                    value={selectedDept}
                    onChange={(e) => onDeptChange(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                    <option value="ALL">Todos los grupos ({recordsLength})</option>
                    {departments.map(d => (
                        <option key={d} value={d}>{d}</option>
                    ))}
                </select>
                {activeView === 'CONTROL' && (
                    <>
                        <select value={groupBy} onChange={(event) => onGroupByChange(event.target.value as GroupBy)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium dark:border-slate-800 dark:bg-slate-900" aria-label="Agrupar empleados">
                            <option value="DEPARTMENT">Agrupar por departamento</option>
                            <option value="CATEGORY">Agrupar por categoría</option>
                        </select>
                        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" aria-label="Columnas visibles">
                            <button type="button" onClick={() => onColumnPresetChange('ESSENTIAL')} aria-pressed={columnPreset === 'ESSENTIAL'} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${columnPreset === 'ESSENTIAL' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950' : 'text-slate-500'}`}>Esenciales</button>
                            <button type="button" onClick={() => onColumnPresetChange('ALL')} aria-pressed={columnPreset === 'ALL'} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${columnPreset === 'ALL' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950' : 'text-slate-500'}`}>Todas</button>
                        </div>
                    </>
                )}
                {activeView === 'GESTORIA' && (
                    <select value={gestoriaStatusFilter} onChange={(event) => onGestoriaStatusFilterChange(event.target.value as GestoriaStatusFilter)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium dark:border-slate-800 dark:bg-slate-900">
                        <option value="ALL">Todos los estados</option>
                        <option value="ERROR">Solo incidencias</option>
                        <option value="READY">Preparados</option>
                        <option value="WITH_VALUES">Con importes</option>
                    </select>
                )}
            </div>
        </div>
    );
}
