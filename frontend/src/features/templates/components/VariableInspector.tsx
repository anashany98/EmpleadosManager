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

export function VariableInspector({ elements, onInsertVariable, showGrid, onToggleGrid }: VariableInspectorProps) {
    const [popoverOpen, setPopoverOpen] = useState(false);
    const referencedVariables = collectVariables(elements);

    return (
        <>
            <div className="border-t border-slate-200 px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                    <h3 className="flex items-center gap-1 text-xs font-bold uppercase text-slate-500">
                        <Variable size={14} />
                        Variables en uso
                    </h3>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={onToggleGrid}
                            className={`rounded-md p-1 text-xs ${
                                showGrid ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-700'
                            }`}
                            title={showGrid ? 'Ocultar cuadrícula' : 'Mostrar cuadrícula'}
                            data-testid="toggle-grid"
                        >
                            {showGrid ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button
                            type="button"
                            onClick={() => setPopoverOpen(true)}
                            className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                            data-testid="open-variable-popover"
                        >
                            + Insertar
                        </button>
                    </div>
                </div>
                {referencedVariables.length === 0 ? (
                    <p className="text-xs text-slate-400">No hay variables en esta plantilla.</p>
                ) : (
                    <ul className="space-y-1">
                        {referencedVariables.map((variable) => (
                            <li
                                key={variable.key}
                                className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
                                    variable.known
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-red-50 text-red-700'
                                }`}
                                title={variable.known ? 'Variable reconocida' : 'Variable no definida'}
                                data-testid={`variable-status-${variable.key}`}
                            >
                                <span className="font-mono">{`{{${variable.key}}}`}</span>
                                <span className="text-[10px] font-semibold uppercase tracking-wide">
                                    {variable.known ? 'OK' : 'No definida'}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {popoverOpen && (
                <InsertVariablePopover
                    onInsert={(variable) => {
                        setPopoverOpen(false);
                        onInsertVariable(variable);
                    }}
                    onClose={() => setPopoverOpen(false)}
                />
            )}
        </>
    );
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
