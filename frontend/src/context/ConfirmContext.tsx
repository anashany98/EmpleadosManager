import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import ConfirmDialog from '../components/ui/ConfirmDialog';

interface ConfirmOptions {
    title: string;
    message: string | ReactNode;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
}

interface ConfirmContextType {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [dialogConfig, setDialogConfig] = useState<ConfirmOptions & { isOpen: boolean; resolve: (val: boolean) => void } | null>(null);

    const confirm = (options: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setDialogConfig({
                ...options,
                isOpen: true,
                resolve
            });
        });
    };

    const handleClose = () => {
        if (dialogConfig) {
            dialogConfig.resolve(false);
            setDialogConfig(null);
        }
    };

    React.useEffect(() => {
        const handler = () => handleClose();
        document.addEventListener('close-confirm-dialog', handler);
        return () => document.removeEventListener('close-confirm-dialog', handler);
    }, [dialogConfig]);

    const handleConfirm = () => {
        if (dialogConfig) {
            dialogConfig.resolve(true);
            setDialogConfig(null);
        }
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            {dialogConfig && (
                <ConfirmDialog
                    isOpen={dialogConfig.isOpen}
                    title={dialogConfig.title}
                    message={dialogConfig.message}
                    confirmText={dialogConfig.confirmText}
                    cancelText={dialogConfig.cancelText}
                    type={dialogConfig.type}
                    onClose={handleClose}
                    onConfirm={handleConfirm}
                />
            )}
        </ConfirmContext.Provider>
    );
};

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context.confirm;
};
