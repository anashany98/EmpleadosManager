import { Save, X } from 'lucide-react';

interface UnsavedChangesBannerProps {
    visible: boolean;
    saving?: boolean;
    onSave: () => void;
    onDiscard: () => void;
}

export function UnsavedChangesBanner({ visible, saving, onSave, onDiscard }: UnsavedChangesBannerProps) {
    if (!visible) return null;
    return (
        <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
        >
            <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
                <span className="font-medium">Tienes cambios sin guardar.</span>
                <span className="text-amber-700/80">Se perderán si navegas a otra sección.</span>
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onDiscard}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                >
                    <X size={14} />
                    Descartar
                </button>
                <button
                    type="button"
                    onClick={onSave}
                    disabled={saving}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                >
                    <Save size={14} />
                    {saving ? 'Guardando...' : 'Guardar'}
                </button>
            </div>
        </div>
    );
}
