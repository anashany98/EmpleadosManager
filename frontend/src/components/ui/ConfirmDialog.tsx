import type { ReactNode } from 'react';
import Modal from './Modal';
import { AlertCircle, Trash2, HelpCircle } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: ReactNode;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    type = 'info'
}: ConfirmDialogProps) {
    const icons = {
        danger: <Trash2 className="text-red-600 dark:text-red-400" size={32} />,
        warning: <AlertCircle className="text-amber-600 dark:text-amber-400" size={32} />,
        info: <HelpCircle className="text-blue-600 dark:text-blue-400" size={32} />
    };

    const confirmButtonClasses = {
        danger: 'bg-red-600 hover:bg-red-700 shadow-red-500/30',
        warning: 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/30',
        info: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
            <div className="flex flex-col items-center text-center space-y-6 py-4">
                <div className={`p-4 rounded-full ${type === 'danger' ? 'bg-red-50 dark:bg-red-900/20' : type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                    {icons[type]}
                </div>

                <div className="space-y-2">
                    <p className="text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                        {message}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full pt-4">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`flex-1 px-6 py-3 rounded-2xl text-white font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-95 ${confirmButtonClasses[type]}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
