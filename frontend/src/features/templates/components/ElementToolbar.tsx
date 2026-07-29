import { Image as ImageIcon, Minus, QrCode, Square, Type, Variable } from 'lucide-react';
import type { ElementType } from './types';
import { ELEMENT_LIBRARY } from './elements';

const ICONS: Record<string, typeof Type> = { Type, Variable, Square, Minus, Image: ImageIcon, QrCode };
const TOOLTIPS: Record<ElementType, string> = {
    text: 'Anadir texto', variable: 'Anadir variable', box: 'Anadir caja',
    line: 'Anadir linea', image: 'Anadir imagen', logo: 'Anadir logo',
    qr: 'QR para archivar en el trabajador'
};

interface ElementToolbarProps {
    onAdd: (type: ElementType) => void;
    onOpenVariables: (variableKey?: string) => void;
}

export function ElementToolbar({ onAdd, onOpenVariables }: ElementToolbarProps) {
    return (
        <div className="flex w-[60px] flex-col items-center gap-1.5 border-r border-gray-200 bg-white py-4">
            <div className="mb-1 text-[8px] font-bold uppercase tracking-[0.1em] text-gray-400">Elementos</div>
            {ELEMENT_LIBRARY.map((desc) => {
                const Icon = ICONS[desc.icon] || Type;
                return (
                    <button
                        key={desc.type}
                        type="button"
                        onClick={() => onAdd(desc.type)}
                        className="group flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 transition-all duration-150 hover:bg-indigo-50 hover:text-indigo-600 hover:shadow-sm active:scale-95"
                        title={TOOLTIPS[desc.type]}
                        aria-label={TOOLTIPS[desc.type]}
                        data-testid={`toolbar-add-${desc.type}`}
                    >
                        <Icon size={20} strokeWidth={1.8} />
                    </button>
                );
            })}
            <div className="my-2 h-px w-8 bg-gray-100" />
            <div className="mb-1 text-[8px] font-bold uppercase tracking-[0.1em] text-gray-400">Vars</div>
            <button
                type="button"
                onClick={() => onOpenVariables()}
                className="group flex h-11 w-11 items-center justify-center rounded-xl text-emerald-400 transition-all duration-150 hover:bg-emerald-50 hover:text-emerald-600 hover:shadow-sm active:scale-95"
                title="Insertar variable"
                aria-label="Insertar variable"
                data-testid="toolbar-insert-variable"
            >
                <Variable size={20} strokeWidth={1.8} />
            </button>
        </div>
    );
}
