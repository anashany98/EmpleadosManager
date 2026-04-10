interface EmployeesSelectionBarProps {
    selectedCount: number;
    filteredCount: number;
    onClearSelection: () => void;
}

export function EmployeesSelectionBar({ selectedCount, filteredCount, onClearSelection }: EmployeesSelectionBarProps) {
    if (selectedCount === 0) return null;

    return (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/30 flex items-center gap-2">
            <span className="text-sm text-blue-700 dark:text-blue-400 font-medium">
                {selectedCount} de {filteredCount} seleccionados
            </span>
            <button onClick={onClearSelection} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                Limpiar selección
            </button>
        </div>
    );
}

