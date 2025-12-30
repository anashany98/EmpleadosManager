import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, UserX, UserCheck, Briefcase, Archive } from 'lucide-react';

interface BulkActionToolbarProps {
    selectedCount: number;
    onClearSelection: () => void;
    onAction: (action: string) => void;
    actions: {
        id: string;
        label: string;
        icon: React.ReactNode;
        variant?: 'default' | 'danger' | 'warning';
    }[];
}

export default function BulkActionToolbar({ selectedCount, onClearSelection, onAction, actions }: BulkActionToolbarProps) {
    return (
        <AnimatePresence>
            {selectedCount > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-2xl">
                    <motion.div
                        initial={{ y: 50, opacity: 0, scale: 0.95 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 50, opacity: 0, scale: 0.95 }}
                        className="bg-slate-900 text-white p-2 rounded-2xl shadow-2xl flex items-center gap-4 pl-6 border border-slate-700/50 backdrop-blur-md"
                    >
                        <div className="flex items-center gap-3 border-r border-slate-700 pr-4">
                            <span className="font-bold flex items-center gap-2">
                                <span className="flex items-center justify-center bg-blue-600 w-6 h-6 rounded-full text-xs">
                                    {selectedCount}
                                </span>
                                <span className="hidden sm:inline">Seleccionados</span>
                            </span>
                            <button
                                onClick={onClearSelection}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex-1 flex justify-center sm:justify-start gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
                            {actions.map((action) => (
                                <button
                                    key={action.id}
                                    onClick={() => onAction(action.id)}
                                    className={`
                                        flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap
                                        ${action.variant === 'danger'
                                            ? 'hover:bg-rose-500/20 text-rose-400 hover:text-rose-300'
                                            : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                                        }
                                    `}
                                >
                                    {action.icon}
                                    <span className="hidden md:inline">{action.label}</span>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

// Predefined configurations for convenience
export const EMPLOYEE_BULK_ACTIONS = [
    { id: 'activate', label: 'Activar', icon: <UserCheck size={18} />, variant: 'default' as const },
    { id: 'deactivate', label: 'Desactivar', icon: <UserX size={18} />, variant: 'warning' as const },
    { id: 'change_dept', label: 'Mover Dpto.', icon: <Briefcase size={18} />, variant: 'default' as const },
    { id: 'delete', label: 'Eliminar', icon: <Trash2 size={18} />, variant: 'danger' as const },
];

export const INVENTORY_BULK_ACTIONS = [
    { id: 'status_available', label: 'Marcar Disponible', icon: <Archive size={18} />, variant: 'default' as const },
    { id: 'delete', label: 'Eliminar', icon: <Trash2 size={18} />, variant: 'danger' as const },
];
