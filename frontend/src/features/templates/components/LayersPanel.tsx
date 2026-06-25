import {
    ChevronDown,
    ChevronUp,
    Image as ImageIcon,
    Layers,
    Minus,
    Square,
    Trash2,
    Type,
    Variable
} from 'lucide-react';
import type { CanvasElement } from './types';

interface LayersPanelProps {
    elements: CanvasElement[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onMove: (id: string, direction: 'up' | 'down') => void;
    onDelete: (id: string) => void;
}

const ICONS: Partial<Record<CanvasElement['type'], typeof Type>> = {
    text: Type,
    variable: Variable,
    box: Square,
    line: Minus,
    image: ImageIcon
};

function describe(element: CanvasElement): string {
    switch (element.type) {
        case 'text':
            return element.content || 'Texto';
        case 'variable':
            return element.content || '{{variable}}';
        case 'box':
            return 'Caja';
        case 'line':
            return 'Línea';
        case 'image':
            return 'Imagen';
        default:
            return 'Elemento';
    }
}

export function LayersPanel({ elements, selectedId, onSelect, onMove, onDelete }: LayersPanelProps) {
    return (
        <div className="border-b border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                <Layers size={16} className="text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Capas ({elements.length})</span>
            </div>
            <div className="max-h-[200px] overflow-auto">
                {elements.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-400">Sin elementos</div>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {elements.map((element, index) => {
                            const Icon = ICONS[element.type] || Type;
                            const isSelected = selectedId === element.id;
                            return (
                                <li
                                    key={element.id}
                                    className={`flex items-center gap-2 transition-colors ${
                                        isSelected ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => onSelect(element.id)}
                                        className="flex flex-1 items-center gap-2 px-4 py-2 text-left"
                                        data-testid={`layer-${element.id}`}
                                    >
                                        <Icon size={14} />
                                        <span className="flex-1 truncate text-xs">{describe(element)}</span>
                                        <span className="text-xs text-slate-400">#{index + 1}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onMove(element.id, 'up')}
                                        className="p-1 text-slate-400 hover:text-slate-700"
                                        title="Subir capa"
                                        aria-label={`Subir capa ${describe(element)}`}
                                    >
                                        <ChevronUp size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onMove(element.id, 'down')}
                                        className="p-1 text-slate-400 hover:text-slate-700"
                                        title="Bajar capa"
                                        aria-label={`Bajar capa ${describe(element)}`}
                                    >
                                        <ChevronDown size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onDelete(element.id)}
                                        className="p-1 text-slate-400 hover:text-red-500"
                                        title="Eliminar capa"
                                        aria-label={`Eliminar capa ${describe(element)}`}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
