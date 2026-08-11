import { ChevronDown, ChevronUp, Image as ImageIcon, Minus, QrCode, Square, Trash2, Type, Variable } from 'lucide-react';
import type { CanvasElement } from './types';

const ICONS: Partial<Record<CanvasElement['type'], typeof Type>> = {
    text: Type, variable: Variable, box: Square, line: Minus, image: ImageIcon, qr: QrCode
};

const TYPE_COLORS: Record<string, string> = {
    text: 'text-gray-500', variable: 'text-emerald-500', box: 'text-blue-500',
    line: 'text-amber-500', image: 'text-purple-500', qr: 'text-teal-600'
};

const TYPE_BG: Record<string, string> = {
    text: 'bg-gray-50', variable: 'bg-emerald-50', box: 'bg-blue-50',
    line: 'bg-amber-50', image: 'bg-purple-50', qr: 'bg-teal-50'
};

function describe(element: CanvasElement): string {
    switch (element.type) {
        case 'text': return element.content || 'Texto';
        case 'variable': return element.content || '{{variable}}';
        case 'box': return 'Caja';
        case 'line': return 'Linea';
        case 'image': return 'Imagen';
        case 'qr': return 'QR de archivo';
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
        <div className="border-b border-gray-200">
            <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Capas ({elements.length})</span>
            </div>
            <div className="max-h-[160px] overflow-auto px-2 pb-2">
                {elements.length === 0 ? (
                    <div className="px-2 py-5 text-center text-[11px] text-gray-300">Sin elementos</div>
                ) : (
                    <ul className="space-y-1">
                        {[...elements].reverse().map((element, ri) => {
                            const idx = elements.length - 1 - ri;
                            const Icon = ICONS[element.type] || Type;
                            const isSelected = selectedId === element.id;
                            return (
                                <li
                                    key={element.id}
                                    className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                                        isSelected ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-gray-50'
                                    }`}
                                >
                                    <button type="button" onClick={() => onSelect(element.id)} className="flex flex-1 items-center gap-2 text-left" data-testid={`layer-${element.id}`}>
                                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${TYPE_BG[element.type] || 'bg-gray-50'}`}>
                                            <Icon size={12} className={TYPE_COLORS[element.type] || 'text-gray-500'} />
                                        </div>
                                        <span className={`flex-1 truncate text-[11px] ${isSelected ? 'font-medium text-indigo-700' : 'text-gray-600'}`}>
                                            {describe(element)}
                                        </span>
                                        <span className="text-[9px] text-gray-300 font-mono">#{idx + 1}</span>
                                    </button>
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button type="button" onClick={() => onMove(element.id, 'up')} className="rounded p-0.5 text-gray-300 hover:text-gray-600" title="Subir"><ChevronUp size={11} /></button>
                                        <button type="button" onClick={() => onMove(element.id, 'down')} className="rounded p-0.5 text-gray-300 hover:text-gray-600" title="Bajar"><ChevronDown size={11} /></button>
                                        {!element.locked && (
                                            <button type="button" onClick={() => onDelete(element.id)} className="rounded p-0.5 text-gray-300 hover:text-red-500" title="Eliminar"><Trash2 size={11} /></button>
                                        )}
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
