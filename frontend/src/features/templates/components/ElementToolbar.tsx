import {
    Image as ImageIcon,
    Minus,
    Square,
    Type,
    Variable
} from 'lucide-react';
import type { ElementType } from './elements';
import { ELEMENT_LIBRARY } from './elements';

interface ToolbarProps {
    onAdd: (type: ElementType) => void;
    onOpenVariables: (variableKey?: string) => void;
}

const ICONS: Record<string, typeof Type> = {
    Type,
    Variable,
    Square,
    Minus,
    Image: ImageIcon
};

export function ElementToolbar({ onAdd, onOpenVariables }: ToolbarProps) {
    return (
        <div className="flex w-16 flex-col items-center gap-2 border-r border-slate-200 bg-white py-4">
            {ELEMENT_LIBRARY.map((descriptor) => {
                const Icon = ICONS[descriptor.icon] || Type;
                return (
                    <button
                        key={descriptor.type}
                        type="button"
                        onClick={() => onAdd(descriptor.type)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-600"
                        title={`Añadir ${descriptor.label.toLowerCase()}`}
                        aria-label={`Añadir ${descriptor.label.toLowerCase()}`}
                        data-testid={`toolbar-add-${descriptor.type}`}
                    >
                        <Icon size={20} />
                    </button>
                );
            })}
            <div className="my-2 h-px w-8 bg-slate-200" />
            <button
                type="button"
                onClick={() => onOpenVariables()}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100"
                title="Insertar variable en el texto seleccionado"
                aria-label="Insertar variable"
                data-testid="toolbar-insert-variable"
            >
                <Variable size={20} />
            </button>
        </div>
    );
}
