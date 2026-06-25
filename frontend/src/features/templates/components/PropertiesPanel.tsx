import { Trash2 } from 'lucide-react';
import { AVAILABLE_VARIABLES } from '../templateBases';
import type { CanvasElement } from './types';

interface PropertiesPanelProps {
    element: CanvasElement | null;
    onUpdate: (id: string, updates: Partial<CanvasElement>) => void;
    onDelete: (id: string) => void;
}

export function PropertiesPanel({ element, onUpdate, onDelete }: PropertiesPanelProps) {
    if (!element) {
        return (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-400">
                Selecciona un elemento para editar sus propiedades
            </div>
        );
    }

    const isTextLike = element.type === 'text' || element.type === 'variable';

    return (
        <div className="space-y-4 p-4" data-testid="properties-panel">
            <div className="rounded-md bg-blue-50 px-2 py-1 text-xs font-bold uppercase text-blue-700">
                {element.type}
            </div>

            {isTextLike && (
                <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                        {element.type === 'variable' ? 'Variable' : 'Texto'}
                    </label>
                    {element.type === 'variable' ? (
                        <select
                            value={element.content.replace(/^\{\{\s*|\s*\}\}$/g, '')}
                            onChange={(e) => onUpdate(element.id, { content: `{{${e.target.value}}}` })}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                            data-testid="variable-select"
                        >
                            <option value="">Seleccionar variable...</option>
                            {AVAILABLE_VARIABLES.map((variable) => (
                                <option key={variable} value={variable}>
                                    {variable}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type="text"
                            value={element.content}
                            onChange={(e) => onUpdate(element.id, { content: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                            data-testid="text-input"
                        />
                    )}
                </div>
            )}

            <div className="grid grid-cols-2 gap-3">
                <NumberField label="X" value={Math.round(element.x)} onChange={(value) => onUpdate(element.id, { x: value })} />
                <NumberField label="Y" value={Math.round(element.y)} onChange={(value) => onUpdate(element.id, { y: value })} />
                <NumberField label="Ancho" value={element.width} onChange={(value) => onUpdate(element.id, { width: value })} />
                <NumberField label="Alto" value={element.height} onChange={(value) => onUpdate(element.id, { height: value })} />
            </div>

            {isTextLike && (
                <NumberField
                    label="Tamaño de fuente"
                    value={element.fontSize || 16}
                    onChange={(value) => onUpdate(element.id, { fontSize: value })}
                />
            )}

            {element.type === 'box' && (
                <ColorField
                    label="Color de fondo"
                    value={element.backgroundColor || '#ffffff'}
                    onChange={(value) => onUpdate(element.id, { backgroundColor: value })}
                />
            )}

            {(element.type === 'box' || element.type === 'line') && (
                <ColorField
                    label="Color de borde"
                    value={element.borderColor || '#1e293b'}
                    onChange={(value) => onUpdate(element.id, { borderColor: value })}
                />
            )}

            {isTextLike && (
                <ColorField
                    label="Color de texto"
                    value={element.color || '#1e293b'}
                    onChange={(value) => onUpdate(element.id, { color: value })}
                />
            )}

            <button
                type="button"
                onClick={() => onDelete(element.id)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
                data-testid="delete-element"
            >
                <Trash2 size={16} />
                Eliminar elemento
            </button>
        </div>
    );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
    return (
        <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
    );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
            <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="h-10 w-full cursor-pointer rounded-lg"
            />
        </div>
    );
}
