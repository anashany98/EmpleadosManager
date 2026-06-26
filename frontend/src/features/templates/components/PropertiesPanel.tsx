import { Trash2, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
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
            <div className="flex flex-1 items-center justify-center p-6 text-center">
                <div>
                    <div className="mx-auto mb-2 h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                        <span className="text-slate-400 text-lg">↖</span>
                    </div>
                    <p className="text-xs text-slate-400">Selecciona un elemento</p>
                </div>
            </div>
        );
    }

    const isTextLike = element.type === 'text' || element.type === 'variable';

    return (
        <div className="space-y-4 p-3" data-testid="properties-panel">
            <div className="flex items-center justify-between">
                <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-600">
                    {element.type}
                </span>
                <button
                    type="button"
                    onClick={() => onDelete(element.id)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    title="Eliminar"
                    data-testid="delete-element"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {isTextLike && (
                <FieldGroup label={element.type === 'variable' ? 'Variable' : 'Texto'}>
                    {element.type === 'variable' ? (
                        <select
                            value={element.content.replace(/^\{\{\s*|\s*\}\}$/g, '')}
                            onChange={(e) => onUpdate(element.id, { content: `{{${e.target.value}}}` })}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            data-testid="variable-select"
                        >
                            <option value="">Seleccionar...</option>
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
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            data-testid="text-input"
                        />
                    )}
                </FieldGroup>
            )}

            <FieldGroup label="Posición">
                <div className="grid grid-cols-2 gap-2">
                    <NumberField label="X" value={Math.round(element.x)} onChange={(v) => onUpdate(element.id, { x: v })} />
                    <NumberField label="Y" value={Math.round(element.y)} onChange={(v) => onUpdate(element.id, { y: v })} />
                </div>
            </FieldGroup>

            <FieldGroup label="Tamaño">
                <div className="grid grid-cols-2 gap-2">
                    <NumberField label="Ancho" value={element.width} onChange={(v) => onUpdate(element.id, { width: v })} />
                    <NumberField label="Alto" value={element.height} onChange={(v) => onUpdate(element.id, { height: v })} />
                </div>
            </FieldGroup>

            {isTextLike && (
                <>
                    <FieldGroup label="Fuente">
                        <div className="flex items-center gap-2">
                            <NumberField
                                label="Tamaño"
                                value={element.fontSize || 16}
                                onChange={(v) => onUpdate(element.id, { fontSize: v })}
                                compact
                            />
                            <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                                <button
                                    type="button"
                                    onClick={() => onUpdate(element.id, { textAlign: 'left' })}
                                    className={`rounded-md p-1.5 transition-colors ${element.textAlign === 'left' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                    title="Izquierda"
                                >
                                    <AlignLeft size={13} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onUpdate(element.id, { textAlign: 'center' })}
                                    className={`rounded-md p-1.5 transition-colors ${element.textAlign === 'center' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                    title="Centro"
                                >
                                    <AlignCenter size={13} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onUpdate(element.id, { textAlign: 'right' })}
                                    className={`rounded-md p-1.5 transition-colors ${element.textAlign === 'right' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                    title="Derecha"
                                >
                                    <AlignRight size={13} />
                                </button>
                            </div>
                        </div>
                    </FieldGroup>
                    <FieldGroup label="Estilo">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => onUpdate(element.id, { fontWeight: element.fontWeight === 'bold' ? 'normal' : 'bold' })}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${element.fontWeight === 'bold' ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                            >
                                B
                            </button>
                            <ColorField
                                label="Color"
                                value={element.color || '#1e293b'}
                                onChange={(v) => onUpdate(element.id, { color: v })}
                            />
                        </div>
                    </FieldGroup>
                </>
            )}

            {element.type === 'box' && (
                <FieldGroup label="Apariencia">
                    <div className="space-y-2">
                        <ColorField
                            label="Relleno"
                            value={element.backgroundColor || '#ffffff'}
                            onChange={(v) => onUpdate(element.id, { backgroundColor: v })}
                        />
                        <ColorField
                            label="Borde"
                            value={element.borderColor || '#1e293b'}
                            onChange={(v) => onUpdate(element.id, { borderColor: v })}
                        />
                        <NumberField
                            label="Grosor borde"
                            value={element.borderWidth || 1}
                            onChange={(v) => onUpdate(element.id, { borderWidth: v })}
                        />
                    </div>
                </FieldGroup>
            )}

            {element.type === 'line' && (
                <FieldGroup label="Color">
                    <ColorField
                        label="Línea"
                        value={element.borderColor || element.color || '#1e293b'}
                        onChange={(v) => onUpdate(element.id, { borderColor: v, color: v })}
                    />
                </FieldGroup>
            )}
        </div>
    );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</label>
            {children}
        </div>
    );
}

function NumberField({ label, value, onChange, compact }: { label: string; value: number; onChange: (value: number) => void; compact?: boolean }) {
    return (
        <div className={compact ? 'flex-1' : ''}>
            {!compact && <label className="mb-0.5 block text-[10px] font-medium text-slate-500">{label}</label>}
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
        </div>
    );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <div className="flex items-center gap-2">
            <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="h-7 w-7 cursor-pointer rounded-md border border-slate-200"
            />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-[11px] text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
        </div>
    );
}
