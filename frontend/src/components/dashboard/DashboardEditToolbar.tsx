import { Eye, EyeOff, GripVertical, Save, X } from 'lucide-react';

interface DashboardEditToolbarProps {
  isEditing: boolean;
  onToggleEdit: () => void;
  onToggleWidget: (widgetId: string) => void;
  visibleWidgets: string[];
  widgetNames: Record<string, string>;
}

export default function DashboardEditToolbar({
  isEditing,
  onToggleEdit,
  onToggleWidget,
  visibleWidgets,
  widgetNames
}: DashboardEditToolbarProps) {
  if (!isEditing) {
    return (
      <button
        onClick={onToggleEdit}
        className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <GripVertical size={16} />
        Personalizar
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-lg">
      <span className="text-sm font-medium text-slate-500 dark:text-slate-400 mr-2">
        Editando:
      </span>

      {Object.entries(widgetNames).map(([id, name]) => {
        const isVisible = visibleWidgets.includes(id);
        return (
          <button
            key={id}
            onClick={() => onToggleWidget(id)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
              isVisible
                ? 'bg-white dark:bg-slate-700 shadow-sm'
                : 'bg-slate-200 dark:bg-slate-600 opacity-50'
            }`}
            title={isVisible ? 'Ocultar' : 'Mostrar'}
          >
            {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
            {name}
          </button>
        );
      })}

      <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 mx-2" />

      <button
        onClick={onToggleEdit}
        className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
      >
        <Save size={12} />
        Guardar
      </button>
      <button
        onClick={onToggleEdit}
        className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
      >
        <X size={12} />
        Cancelar
      </button>
    </div>
  );
}