import { ChevronDown, ChevronUp, Image as ImageIcon, Minus, Square, Trash2, Type, Variable } from 'lucide-react';
import type { CanvasElement } from './types';

const ICONS: Partial<Record<CanvasElement['type'], typeof Type>> = {
    text: Type, variable: Variable, box: Square, line: Minus, image: ImageIcon
};

const TYPE_COLORS: Record<string, string> = {
    text: 'text-slate-500', variable: 'text-emerald-500', box: 'text-blue-500',
    line: 'text-amber-500', image: 'text-purple-500'
};

function describe(element: CanvasElement): string {
    switch (element.type) {
        case 'text': return element.content || 'Texto';
        case 'variable': return element.content || '{{variable}}';
        case 'box': return 'Caja';
        case 'line': return 'Linea';
        case 'image': return 'Imagen';
        default: return 'Elemento';
    }
}

interface LayersPanelProps {
    elements: CanvasElement[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onMove: (id: string, direction: 'up' | 'down') => void;
    onDelete: (id: string) => void;
}

export function LayersPanel({ elements, selectedId, onSelect, onMove, onDelete }: LayersPanelProps) {
    return (
        <div className="border-b border-slate-200">
            <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Capas ({elements.length})</span>
            </div>
            <div className="max-h-[180px] overflow-auto">
                {elements.length === 0 ? (
                    <div className="px-3 py-6 text-center text-[11px] text-slate-400">Sin elementos</div>
                ) : (
                    <ul className="space-y-0.5 px-1.5 pb-1.5">
                        {[...elements].reverse().map((element, ri) => {
                            const idx = elements.length - 1 - ri;
                            const Icon = ICONS[element.type] || Type;
                            const isSelected = selectedId === element.id;
                            return (
                                <li key={element.id} className={`group flex items-center gap-1.5 rounded-lg transition-colors ${isSelected ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-50'}`}>
                                    <button type="button" onClick={() => onSelect(element.id)} className="flex flex-1 items-center gap-2 px-2 py-1.5 text-left" data-testid={`layer-${element.id}`}>
                                        <Icon size={12} className={TYPE_COLORS[element.type] || 'text-slate-500'} />
                                        <span className={`flex-1 truncate text-[11px] ${isSelected ? 'font-medium text-indigo-700' : 'text-slate-600'}`}>
                                            {describe(element)}
                                        </span>
                                        <span className="text-[9px] text-slate-400">#{idx + 1}</span>
                                    </button>
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pr-1.5">
                                        <button type="button" onClick={() => onMove(element.id, 'up')} className="rounded p-0.5 text-slate-400 hover:text-slate-700" title="Subir"><ChevronUp size={11} /></button>
                                        <button type="button" onClick={() => onMove(element.id, 'down')} className="rounded p-0.5 text-slate-400 hover:text-slate-700" title="Bajar"><ChevronDown size={11} /></button>
                                        <button type="button" onClick={() => onDelete(element.id)} className="rounded p-0.5 text-slate-400 hover:text-red-500" title="Eliminar"><Trash2 size={11} /></button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
