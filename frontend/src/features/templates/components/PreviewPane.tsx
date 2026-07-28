import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { resolveTemplateContent, EMPTY_PREVIEW_CONTEXT } from '../templateVariables';
import type { CanvasElement } from './types';

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

interface PreviewPaneProps {
    elements: CanvasElement[];
    variableContext: Record<string, unknown>;
    employeeId: string;
    showGrid?: boolean;
    fullWidth?: boolean;
}

export function PreviewPane({ elements, variableContext, employeeId, showGrid, fullWidth = false }: PreviewPaneProps) {
    const [collapsed, setCollapsed] = useState(false);

    const context = useMemo(() => {
        if (employeeId) return variableContext;
        return { ...EMPTY_PREVIEW_CONTEXT, ...variableContext };
    }, [employeeId, variableContext]);

    if (collapsed) {
        return (
            <button type="button" onClick={() => setCollapsed(false)} className="flex h-full w-10 items-center justify-center border-l border-gray-200 bg-white text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600" title="Mostrar previsualizacion">
                <ChevronLeft size={16} />
            </button>
        );
    }

    return (
        <aside className={`flex flex-col border-l border-gray-200 bg-white ${fullWidth ? 'min-w-0 flex-1' : 'w-[320px]'}`}>
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
                <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50">
                        <Eye size={13} className="text-indigo-500" />
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Vista previa</span>
                </div>
                {!fullWidth && (
                    <button type="button" onClick={() => setCollapsed(true)} className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
                        <ChevronRight size={14} />
                    </button>
                )}
            </div>
            <div className="flex-1 overflow-auto bg-gray-50 p-4">
                <div
                    className="relative mx-auto origin-top overflow-hidden bg-white"
                    style={{
                        width: '210mm', maxWidth: fullWidth ? 'min(100%, 210mm)' : '100%', aspectRatio: '210 / 297',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                        borderRadius: '3px',
                        backgroundImage: showGrid ? 'radial-gradient(circle, #d1d5db 0.8px, transparent 0.8px)' : undefined,
                        backgroundSize: '16px 16px'
                    }}
                >
                    {elements.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                            <div className="text-center">
                                <EyeOff size={32} className="mx-auto mb-2 opacity-40" />
                                <p className="text-[11px] font-medium">Vacio</p>
                            </div>
                        </div>
                    )}
                    {elements.map((element) => (
                        <PreviewElement key={element.id} element={element} context={context} />
                    ))}
                </div>
                {!employeeId && (
                    <p className="mt-3 px-1 text-[10px] text-gray-400 leading-relaxed">
                        Mostrando datos de ejemplo. Selecciona un empleado del selector inferior para ver valores reales.
                    </p>
                )}
            </div>
        </aside>
    );
}

function PreviewElement({ element, context }: { element: CanvasElement; context: Record<string, unknown> }) {
    const isTextLike = element.type === 'text' || element.type === 'variable';
    const pctX = `${(element.x / A4_WIDTH) * 100}%`;
    const pctY = `${(element.y / A4_HEIGHT) * 100}%`;
    const pctW = `${(element.width / A4_WIDTH) * 100}%`;
    const pctH = `${(element.height / A4_HEIGHT) * 100}%`;

    if (element.type === 'line') {
        return (
            <div style={{ position: 'absolute', left: pctX, top: pctY, width: pctW, height: Math.max(1, element.height), backgroundColor: element.borderColor || element.color || '#1e293b' }} />
        );
    }

    if (element.type === 'image') {
        return (
            <div style={{ position: 'absolute', left: pctX, top: pctY, width: pctW, height: pctH, overflow: 'hidden' }}>
                {element.src ? (
                    <img src={element.src} alt="" className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gray-100 text-[8px] text-gray-400">Imagen</div>
                )}
            </div>
        );
    }

    return (
        <div
            style={{
                position: 'absolute', left: pctX, top: pctY, width: pctW, height: pctH,
                fontSize: element.fontSize,
                fontWeight: element.fontWeight as 'normal' | 'bold' | undefined,
                color: element.color, backgroundColor: element.backgroundColor,
                borderColor: element.borderColor,
                borderWidth: element.type === 'box' && element.borderWidth ? `${element.borderWidth}px` : undefined,
                borderStyle: element.type === 'box' ? 'solid' : undefined,
                borderRadius: element.type === 'box' ? '1px' : undefined,
                display: 'flex', alignItems: 'center', padding: '0 4px',
                textAlign: element.textAlign || 'left',
                justifyContent: element.textAlign === 'center' ? 'center' : element.textAlign === 'right' ? 'flex-end' : 'flex-start',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                lineHeight: '1.4'
            }}
        >
            {isTextLike ? resolveTemplateContent(element.content, context) : ''}
        </div>
    );
}
