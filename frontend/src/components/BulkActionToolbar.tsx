import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, UserX, UserCheck, Briefcase, Archive, AlertCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface BulkAction {
    id: string;
    label: string;
    icon: React.ReactNode;
    variant?: 'default' | 'danger' | 'warning' | 'success';
}

interface BulkActionToolbarProps {
    selectedCount: number;
    totalCount?: number;
    onClearSelection: () => void;
    onAction: (action: string) => void;
    actions: BulkAction[];
    entityName?: string;
}

export default function BulkActionToolbar({ 
    selectedCount, 
    totalCount, 
    onClearSelection, 
    onAction, 
    actions,
    entityName = 'elementos'
}: BulkActionToolbarProps) {
    const toolbarRef = useRef<HTMLDivElement>(null);

    // Focus trap and keyboard navigation
    useEffect(() => {
        if (selectedCount > 0) {
            // Announce to screen readers
            const announcement = document.getElementById('bulk-selection-announcement');
            if (announcement) {
                announcement.textContent = `${selectedCount} ${entityName} seleccionados. Usa las flechas para navegar por las acciones.`;
            }
        }
    }, [selectedCount, entityName]);

    const handleKeyDown = (e: React.KeyboardEvent, action: BulkAction) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onAction(action.id);
        }
    };

    const getVariantStyles = (variant: string = 'default') => {
        switch (variant) {
            case 'danger':
                return 'hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 focus-visible:ring-rose-500';
            case 'warning':
                return 'hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 focus-visible:ring-amber-500';
            case 'success':
                return 'hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 focus-visible:ring-emerald-500';
            default:
                return 'hover:bg-slate-800 text-slate-300 hover:text-white focus-visible:ring-blue-500';
        }
    };

    return (
        <>
            {/* Screen reader announcement */}
            <div 
                id="bulk-selection-announcement" 
                role="status" 
                aria-live="polite" 
                className="sr-only"
            />

            <AnimatePresence>
                {selectedCount > 0 && (
                    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-2xl">
                        <motion.div
                            ref={toolbarRef}
                            initial={{ y: 50, opacity: 0, scale: 0.95 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: 50, opacity: 0, scale: 0.95 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-slate-900 text-white p-2 rounded-2xl shadow-2xl flex items-center gap-2 sm:gap-4 pl-4 border border-slate-700/50 backdrop-blur-md"
                            role="toolbar"
                            aria-label={`Acciones masivas para ${selectedCount} ${entityName} seleccionados`}
                        >
                            {/* Selection Counter */}
                            <div className="flex items-center gap-2 sm:gap-3 border-r border-slate-700 pr-3 sm:pr-4">
                                <div className="flex items-center gap-2">
                                    <span 
                                        className="flex items-center justify-center bg-blue-600 w-6 h-6 rounded-full text-xs font-bold"
                                        aria-hidden="true"
                                    >
                                        {selectedCount}
                                    </span>
                                    <span className="hidden sm:inline text-sm font-medium">
                                        {selectedCount === 1 ? 'Seleccionado' : 'Seleccionados'}
                                    </span>
                                </div>
                                
                                {/* Clear Selection Button */}
                                <button
                                    onClick={onClearSelection}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                    aria-label="Limpiar selección"
                                    title="Limpiar selección"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Action Buttons */}
                            <div 
                                className="flex-1 flex justify-center sm:justify-start gap-1 sm:gap-2 overflow-x-auto no-scrollbar"
                                role="group"
                                aria-label="Acciones disponibles"
                            >
                                {actions.map((action) => (
                                    <button
                                        key={action.id}
                                        onClick={() => onAction(action.id)}
                                        onKeyDown={(e) => handleKeyDown(e, action)}
                                        className={`
                                            flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap
                                            focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
                                            ${getVariantStyles(action.variant)}
                                        `}
                                        aria-label={`${action.label} ${selectedCount} ${entityName}`}
                                    >
                                        {action.icon}
                                        <span className="hidden md:inline">{action.label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Help Text - Desktop only */}
                            <div className="hidden lg:flex items-center gap-1 text-xs text-slate-500 border-l border-slate-700 pl-3">
                                <AlertCircle size={12} />
                                <span>Esc para deseleccionar</span>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}

// Predefined configurations for convenience
export const EMPLOYEE_BULK_ACTIONS: BulkAction[] = [
    { id: 'activate', label: 'Activar', icon: <UserCheck size={18} />, variant: 'success' },
    { id: 'deactivate', label: 'Desactivar', icon: <UserX size={18} />, variant: 'warning' },
    { id: 'change_dept', label: 'Mover Dpto.', icon: <Briefcase size={18} />, variant: 'default' },
    { id: 'delete', label: 'Eliminar', icon: <Trash2 size={18} />, variant: 'danger' },
];

export const INVENTORY_BULK_ACTIONS: BulkAction[] = [
    { id: 'status_available', label: 'Marcar Disponible', icon: <Archive size={18} />, variant: 'success' },
    { id: 'delete', label: 'Eliminar', icon: <Trash2 size={18} />, variant: 'danger' },
];
