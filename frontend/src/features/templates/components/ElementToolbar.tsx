import { Image as ImageIcon, Minus, Square, Type, Variable } from 'lucide-react';
import type { ElementType } from './types';
import { ELEMENT_LIBRARY } from './elements';

const ICONS: Record<string, typeof Type> = { Type, Variable, Square, Minus, Image: ImageIcon };
const TOOLTIPS: Record<ElementType, string> = {
    text: 'Anadir texto', variable: 'Anadir variable', box: 'Anadir caja',
    line: 'Anadir linea', image: 'Anadir imagen', logo: 'Anadir logo'
};

interface ElementToolbarProps {
    onAdd: (type: ElementType) => void;
    onOpenVariables: (variableKey?: string) => void;
}

export function ElementToolbar({ onAdd, onOpenVariables }: ElementToolbarProps) {
    return (
        <div className="flex w-14 flex-col items-center gap-1 border-r border-slate-200 bg-white py-3">
            <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">Elementos</div>
            {ELEMENT_LIBRARY.map((desc) => {
                const Icon = ICONS[desc.icon] || Type;
                return (
                    <button
                        key={desc.type}
                        type="button"
                        onClick={() => onAdd(desc.type)}
                        className="group flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-indigo-50 hover:text-indigo-600 hover:shadow-sm"
                        title={TOOLTIPS[desc.type]}
                        aria-label={TOOLTIPS[desc.type]}
                        data-testid={`toolbar-add-${desc.type}`}
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
