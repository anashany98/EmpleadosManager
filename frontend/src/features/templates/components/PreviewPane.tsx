import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { resolveTemplateContent, EMPTY_PREVIEW_CONTEXT } from '../templateVariables';
import type { CanvasElement } from './types';

interface PreviewPaneProps {
    elements: CanvasElement[];
    variableContext: Record<string, unknown>;
    employeeId: string;
    showGrid?: boolean;
}

export function PreviewPane({ elements, variableContext, employeeId, showGrid }: PreviewPaneProps) {
    const [collapsed, setCollapsed] = useState(false);

    const context = useMemo(() => {
        if (employeeId) return variableContext;
        return { ...EMPTY_PREVIEW_CONTEXT, ...variableContext };
    }, [employeeId, variableContext]);

    if (collapsed) {
        return (
            <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="flex h-full w-10 items-center justify-center border-l border-slate-200 bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                title="Mostrar previsualización"
            >
                <ChevronLeft size={16} />
            </button>
        );
    }

    return (
        <aside className="flex w-[280px] flex-col border-l border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                <div className="flex items-center gap-1.5">
                    <Eye size={13} className="text-slate-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vista previa</span>
                </div>
                <button
                    type="button"
                    onClick={() => setCollapsed(true)}
                    className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                    <ChevronRight size={14} />
                </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-50 p-3">
                <div
                    className="relative mx-auto origin-top bg-white shadow-md rounded-sm overflow-hidden"
                    style={{
                        width: '210mm',
                        maxWidth: '100%',
                        aspectRatio: '210 / 297',
                        backgroundImage: showGrid
                            ? 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)'
                            : undefined,
                        backgroundSize: '20px 20px'
                    }}
                >
                    <PreviewElements elements={elements} context={context} />
                </div>
                {!employeeId && (
                    <p className="mt-2 px-1 text-[10px] text-slate-400 leading-tight">
                        Datos de ejemplo. Selecciona un empleado para ver valores reales.
                    </p>
                )}
            </div>
        </aside>
    );
}

function PreviewElements({
    elements,
    context
}: {
    elements: CanvasElement[];
    context: Record<string, unknown>;
}) {
    return (
        <>
            {elements.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                    <div className="text-center">
                        <EyeOff size={28} className="mx-auto mb-1 opacity-50" />
                        <p className="text-[10px]">Vacío</p>
                    </div>
                </div>
            )}
            {elements.map((element) => (
                <PreviewElement key={element.id} element={element} context={context} />
            ))}
        </>
    );
}

function PreviewElement({
    element,
    context
}: {
    element: CanvasElement;
    context: Record<string, unknown>;
}) {
    const isTextLike = element.type === 'text' || element.type === 'variable';

    if (element.type === 'line') {
        return (
            <div
                style={{
                    position: 'absolute',
                    left: `${(element.x / 794) * 100}%`,
                    top: `${(element.y / 1123) * 100}%`,
                    width: `${(element.width / 794) * 100}%`,
                    height: Math.max(1, element.height),
                    backgroundColor: element.borderColor || element.color || '#1e293b'
                }}
            />
        );
    }

    if (element.type === 'image') {
        return (
            <div
                style={{
                    position: 'absolute',
                    left: `${(element.x / 794) * 100}%`,
                    top: `${(element.y / 1123) * 100}%`,
                    width: `${(element.width / 794) * 100}%`,
                    height: `${(element.height / 1123) * 100}%`,
                    overflow: 'hidden'
                }}
            >
                {element.src ? (
                    <img src={element.src} alt="" className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-[8px] text-slate-400">
                        Imagen
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            style={{
                position: 'absolute',
                left: `${(element.x / 794) * 100}%`,
                top: `${(element.y / 1123) * 100}%`,
                width: `${(element.width / 794) * 100}%`,
                height: `${(element.height / 1123) * 100}%`,
                fontSize: element.fontSize,
                fontWeight: element.fontWeight as 'normal' | 'bold' | undefined,
                color: element.color,
                backgroundColor: element.backgroundColor,
                borderColor: element.borderColor,
                borderWidth: element.type === 'box' && element.borderWidth ? `${element.borderWidth}px` : undefined,
                borderStyle: element.type === 'box' ? 'solid' : undefined,
                display: 'flex',
                alignItems: 'center',
                padding: '0 4px',
                textAlign: element.textAlign || 'left',
                justifyContent:
                    element.textAlign === 'center'
                        ? 'center'
                        : element.textAlign === 'right'
                          ? 'flex-end'
                          : 'flex-start',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
            }}
        >
            {isTextLike ? resolveTemplateContent(element.content, context) : ''}
        </div>
    );
}
