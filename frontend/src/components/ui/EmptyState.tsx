import { Inbox, Search, FileX, AlertCircle } from 'lucide-react';

type EmptyStateVariant = 'default' | 'search' | 'error' | 'no-results';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Reusable empty state component
 * Standardizes empty states across the app (14 different messages consolidated)
 */
export function EmptyState({ 
  variant = 'default', 
  title, 
  description, 
  action,
  className = '' 
}: EmptyStateProps) {
  const icons = {
    default: Inbox,
    search: Search,
    'no-results': FileX,
    error: AlertCircle
  };

  const iconDescriptions = {
    default: 'No hay elementos',
    search: 'Sin resultados de búsqueda',
    'no-results': 'Sin datos',
    error: 'Error'
  };

  const Icon = icons[variant];

  return (
    <div 
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}
      role="status"
      aria-label={iconDescriptions[variant]}
    >
      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Icon 
          size={24} 
          className="text-slate-400" 
          aria-hidden="true"
        />
      </div>
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
      <span className="sr-only">{title}{description ? `. ${description}` : ''}</span>
    </div>
  );
}

/**
 * Pre-configured empty states for common use cases
 */
export const EmptyStates = {
  /** "No se encontraron empleados" */
  employees: (action?: React.ReactNode) => (
    <EmptyState 
      variant="no-results"
      title="No se encontraron empleados"
      description="Intenta ajustar los filtros de búsqueda"
      action={action}
    />
  ),

  /** "No se encontraron resultados" (Command Palette) */
  search: (action?: React.ReactNode) => (
    <EmptyState 
      variant="search"
      title="No se encontraron resultados"
      description="Prueba con otros términos de búsqueda"
      action={action}
    />
  ),

  /** "No hay datos disponibles" (Analytics widgets) */
  analytics: (action?: React.ReactNode) => (
    <EmptyState 
      variant="default"
      title="No hay datos disponibles"
      description="Los datos aparecerán cuando houver información"
      action={action}
    />
  ),

  /** Generic empty */
  generic: (title: string, description?: string, action?: React.ReactNode) => (
    <EmptyState 
      variant="default"
      title={title}
      description={description}
      action={action}
    />
  )
};