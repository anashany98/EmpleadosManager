import { useState, useCallback, useRef, createContext, useContext, ReactNode } from 'react';
import ConfirmDialog from '../components/ui/ConfirmDialog';

/**
 * LOW-004: `window.confirm()` es un diálogo nativo bloqueante
 * que rompe la accesibilidad (no se puede leer con lector de
 * pantalla, no respeta el foco del teclado, no se puede
 * estilizar) y la UX consistente del SPA. Este hook expone
 * una API de promesas `confirm({ title, message, type })`
 * que renderiza el `<ConfirmDialog>` accesible ya existente
 * en `components/ui/`.
 *
 * Uso:
 *   const { confirm } = useConfirm();
 *   const ok = await confirm({
 *     title: '¿Eliminar tarjeta?',
 *     message: 'Esta acción no se puede deshacer.',
 *     type: 'danger',
 *     confirmText: 'Eliminar',
 *   });
 *   if (ok) deleteMutation.mutate(card.id);
 */
export interface ConfirmOptions {
    title: string;
    message: ReactNode;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
}

interface ConfirmState extends ConfirmOptions {
    open: boolean;
    resolve: ((value: boolean) => void) | null;
}

interface ConfirmContextValue {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirmProvider(): { contextValue: ConfirmContextValue; dialog: ReactNode } {
    const [state, setState] = useState<ConfirmState>({
        open: false,
        title: '',
        message: '',
        resolve: null
    });
    // Guardamos el último resolve en un ref para que el
    // onClose siempre pueda resolver aunque el setState no
    // haya confirmado todavía (caso borde: cierre por ESC
    // durante una animación).
    const resolveRef = useRef<((value: boolean) => void) | null>(null);

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise<boolean>((resolve) => {
            resolveRef.current = resolve;
            setState({ open: true, resolve, ...options });
        });
    }, []);

    const handleClose = useCallback((value: boolean) => {
        if (resolveRef.current) {
            resolveRef.current(value);
            resolveRef.current = null;
        }
        setState((prev) => ({ ...prev, open: false, resolve: null }));
    }, []);

    const dialog = (
        <ConfirmDialog
            isOpen={state.open}
            onClose={() => handleClose(false)}
            onConfirm={() => handleClose(true)}
            title={state.title}
            message={state.message}
            confirmText={state.confirmText}
            cancelText={state.cancelText}
            type={state.type}
        />
    );

    return {
        contextValue: { confirm },
        dialog
    };
}

export function useConfirm(): ConfirmContextValue {
    const ctx = useContext(ConfirmContext);
    if (!ctx) {
        throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>');
    }
    return ctx;
}

interface ConfirmProviderProps {
    children: ReactNode;
}

export function ConfirmProvider({ children }: ConfirmProviderProps) {
    const { contextValue, dialog } = useConfirmProvider();
    return (
        <ConfirmContext.Provider value={contextValue}>
            {children}
            {dialog}
        </ConfirmContext.Provider>
    );
}
