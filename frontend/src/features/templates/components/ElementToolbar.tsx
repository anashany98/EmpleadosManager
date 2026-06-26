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

const TOOLTIPS: Record<ElementType, string> = {
    text: 'Añadir texto',
    variable: 'Añadir variable',
    box: 'Añadir caja',
    line: 'Añadir línea',
    image: 'Añadir imagen'
};

export function ElementToolbar({ onAdd, onOpenVariables }: ToolbarProps) {
    return (
        <div className="flex w-14 flex-col items-center gap-1 border-r border-slate-200 bg-white py-3">
            <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">Elementos</div>
            {ELEMENT_LIBRARY.map((descriptor) => {
                const Icon = ICONS[descriptor.icon] || Type;
                return (
                    <button
                        key={descriptor.type}
                        type="button"
                        onClick={() => onAdd(descriptor.type)}
                        className="group flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-indigo-50 hover:text-indigo-600 hover:shadow-sm"
                        title={TOOLTIPS[descriptor.type]}
                        aria-label={TOOLTIPS[descriptor.type]}
                        data-testid={`toolbar-add-${descriptor.type}`}
                    >
                        <Icon size={18} />
                    </button>
                );
            })}
            <div className="my-2 h-px w-8 bg-slate-100" />
            <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">Variables</div>
            <button
                type="button"
                onClick={() => onOpenVariables()}
                className="group flex h-10 w-10 items-center justify-center rounded-xl text-emerald-500 transition-all hover:bg-emerald-50 hover:text-emerald-600 hover:shadow-sm"
                title="Insertar variable"
                aria-label="Insertar variable"
                data-testid="toolbar-insert-variable"
            >
                <Variable size={18} />
            </button>
        </div>
    );
}
