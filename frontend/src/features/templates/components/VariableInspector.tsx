import { useState } from 'react';
import { Eye, EyeOff, Variable } from 'lucide-react';
import { InsertVariablePopover } from './InsertVariablePopover';
import { isKnownVariable } from '../templateVariables';
import type { CanvasElement } from './types';

interface VariableInspectorProps {
    elements: CanvasElement[];
    onInsertVariable: (key: string) => void;
    showGrid: boolean;
    onToggleGrid: () => void;
}

function collectVariables(elements: CanvasElement[]): Array<{ key: string; known: boolean }> {
    const seen = new Set<string>();
    const result: Array<{ key: string; known: boolean }> = [];
    elements.forEach((element) => {
        if (element.type !== 'text' && element.type !== 'variable') return;
        const matches = element.content.match(/\{\{\s*([\w.]+)\s*\}\}/g) || [];
        matches.forEach((match: string) => {
            const key = match.replace(/[{}\s]/g, '');
            if (seen.has(key)) return;
            seen.add(key);
            result.push({ key, known: isKnownVariable(key) });
        });
    });
    return result;
}

export function VariableInspector({ elements, onInsertVariable, showGrid, onToggleGrid }: VariableInspectorProps) {
    const [popoverOpen, setPopoverOpen] = useState(false);
    const referencedVariables = collectVariables(elements);

    return (
        <>
            <div className="px-4 py-3">
                <div className="mb-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <div className="flex h-5 w-5 items-center justify-center rounded bg-emerald-50">
                            <Variable size={11} className="text-emerald-500" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Variables ({referencedVariables.length})</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button type="button" onClick={onToggleGrid} className={`rounded-md p-1 transition-colors ${showGrid ? 'bg-indigo-50 text-indigo-500' : 'text-gray-400 hover:text-gray-600'}`} title={showGrid ? 'Ocultar cuadricula' : 'Mostrar cuadricula'} data-testid="toggle-grid">
                            {showGrid ? <Eye size={13} /> : <EyeOff size={13} />}
                        </button>
                        <button type="button" onClick={() => setPopoverOpen(true)} className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-600 transition-colors hover:bg-emerald-100" data-testid="open-variable-popover">
                            + Insertar
                        </button>
                    </div>
                </div>
                {referencedVariables.length === 0 ? (
                    <p className="text-[11px] text-gray-300 italic">No hay variables en esta plantilla.</p>
                ) : (
                    <ul className="space-y-1">
                        {referencedVariables.map((variable) => (
                            <li
                                key={variable.key}
                                className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] transition-colors ${
                                    variable.known
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-red-50 text-red-600'
                                }`}
                                title={variable.known ? 'Variable reconocida' : 'Variable no definida'}
                                data-testid={`variable-status-${variable.key}`}
                            >
                                <span className="font-mono text-[10px]">{`{{${variable.key}}}`}</span>
                                <span className="text-[9px] font-bold uppercase tracking-wider">
                                    {variable.known ? 'OK' : 'Sin definir'}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {popoverOpen && (
                <InsertVariablePopover
                    onInsert={(variable) => { setPopoverOpen(false); onInsertVariable(variable); }}
                    onClose={() => setPopoverOpen(false)}
                />
            )}
        </>
    );
}
