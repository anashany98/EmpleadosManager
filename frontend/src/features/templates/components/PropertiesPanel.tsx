import { Trash2, AlignLeft, AlignCenter, AlignRight, Bold } from 'lucide-react';
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
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                    <span className="text-xl text-gray-300">↖</span>
                </div>
                <p className="text-[12px] font-medium text-gray-400">Selecciona un elemento</p>
                <p className="mt-1 text-[11px] text-gray-300">Haz clic en el canvas para editarlo</p>
            </div>
        );
    }

    const isTextLike = element.type === 'text' || element.type === 'variable';

    return (
        <div className="space-y-5 p-4" data-testid="properties-panel">
            <div className="flex items-center justify-between">
                <span className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                    {element.type === 'variable' ? 'Variable' : element.type}
                </span>
                <button
                    type="button"
                    onClick={() => onDelete(element.id)}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
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
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[12px] text-gray-700 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
                            data-testid="variable-select"
                        >
                            <option value="">Seleccionar...</option>
                            {AVAILABLE_VARIABLES.map((v) => (
                                <option key={v} value={v}>{v}</option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type="text"
                            value={element.content}
                            onChange={(e) => onUpdate(element.id, { content: e.target.value })}
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[12px] text-gray-700 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
                            data-testid="text-input"
                        />
                    )}
                </FieldGroup>
            )}

            <FieldGroup label="Posicion">
                <div className="grid grid-cols-2 gap-2">
                    <NumberField label="X" value={Math.round(element.x)} onChange={(v) => onUpdate(element.id, { x: v })} />
                    <NumberField label="Y" value={Math.round(element.y)} onChange={(v) => onUpdate(element.id, { y: v })} />
                </div>
            </FieldGroup>

            <FieldGroup label="Tamano">
                <div className="grid grid-cols-2 gap-2">
                    <NumberField label="Ancho" value={element.width} onChange={(v) => onUpdate(element.id, { width: v })} />
                    <NumberField label="Alto" value={element.height} onChange={(v) => onUpdate(element.id, { height: v })} />
                </div>
            </FieldGroup>

            {isTextLike && (
                <>
                    <FieldGroup label="Tipografia">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <NumberField label="Tamano" value={element.fontSize || 16} onChange={(v) => onUpdate(element.id, { fontSize: v })} compact />
                                <button
                                    type="button"
                                    onClick={() => onUpdate(element.id, { fontWeight: element.fontWeight === 'bold' ? 'normal' : 'bold' })}
                                    className={`mt-4 flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${element.fontWeight === 'bold' ? 'border-indigo-300 bg-indigo-50 text-indigo-600' : 'border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                                    title="Negrita"
                                >
                                    <Bold size={14} />
                                </button>
                            </div>
                            <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
                                {(['left', 'center', 'right'] as const).map((align) => (
                                    <button
                                        key={align}
                                        type="button"
                                        onClick={() => onUpdate(element.id, { textAlign: align })}
                                        className={`flex-1 rounded-md p-1.5 transition-colors ${element.textAlign === align ? 'bg-indigo-100 text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                        title={align === 'left' ? 'Izquierda' : align === 'center' ? 'Centro' : 'Derecha'}
                                    >
                                        {align === 'left' ? <AlignLeft size={14} /> : align === 'center' ? <AlignCenter size={14} /> : <AlignRight size={14} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </FieldGroup>
                    <FieldGroup label="Color del texto">
                        <ColorField value={element.color || '#1e293b'} onChange={(v) => onUpdate(element.id, { color: v })} />
                    </FieldGroup>
                </>
            )}

            {element.type === 'box' && (
                <FieldGroup label="Apariencia">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] text-gray-500">Relleno</span>
                            <ColorField value={element.backgroundColor || '#ffffff'} onChange={(v) => onUpdate(element.id, { backgroundColor: v })} compact />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] text-gray-500">Borde</span>
                            <ColorField value={element.borderColor || '#1e293b'} onChange={(v) => onUpdate(element.id, { borderColor: v })} compact />
                        </div>
                        <NumberField label="Grosor" value={element.borderWidth || 1} onChange={(v) => onUpdate(element.id, { borderWidth: v })} />
                    </div>
                </FieldGroup>
            )}

            {element.type === 'line' && (
                <FieldGroup label="Color">
                    <ColorField value={element.borderColor || element.color || '#1e293b'} onChange={(v) => onUpdate(element.id, { borderColor: v, color: v })} />
                </FieldGroup>
            )}
        </div>
    );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</label>
            {children}
        </div>
    );
}

function NumberField({ label, value, onChange, compact }: { label: string; value: number; onChange: (value: number) => void; compact?: boolean }) {
    return (
        <div className={compact ? 'flex-1' : ''}>
            {!compact && <label className="mb-1 block text-[11px] font-medium text-gray-500">{label}</label>}
            <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[12px] text-gray-700 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100" />
        </div>
    );
}

function ColorField({ value, onChange, compact }: { value: string; onChange: (value: string) => void; compact?: boolean }) {
    return (
        <div className={`flex items-center gap-2 ${compact ? '' : ''}`}>
            <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-8 cursor-pointer rounded-lg border border-gray-200 p-0.5" />
            <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 font-mono text-[11px] text-gray-600 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100" />
        </div>
    );
}
