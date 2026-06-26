import { useCallback, useEffect, useRef, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import type { CanvasElement } from './types';

const SNAP_GRID = 10;

function snap(value: number, gridSize: number, enabled: boolean): number {
    if (!enabled) return value;
    const half = gridSize / 2;
    return Math.round((value + half) / gridSize) * gridSize - half;
}

interface DragState {
    id: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    zoom: number;
    mode: 'move' | 'resize';
    handle?: string;
    originWidth?: number;
    originHeight?: number;
}

interface CanvasStageProps {
    elements: CanvasElement[];
    selectedId: string | null;
    zoom: number;
    showGrid: boolean;
    logoUrl: string | null;
    onSelectElement: (id: string | null) => void;
    onMoveElement: (id: string, x: number, y: number) => void;
    onResizeElement: (id: string, width: number, height: number, x?: number, y?: number) => void;
    onMoveStart?: () => void;
    onMoveEnd?: () => void;
}

export function CanvasStage({
    elements, selectedId, zoom, showGrid, logoUrl,
    onSelectElement, onMoveElement, onResizeElement, onMoveStart, onMoveEnd
}: CanvasStageProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<DragState | null>(null);

    useEffect(() => {
        const handlePointerMove = (event: PointerEvent) => {
            const drag = dragRef.current;
            if (!drag) return;
            const factor = drag.zoom / 100;
            const dx = (event.clientX - drag.startX) / factor;
            const dy = (event.clientY - drag.startY) / factor;

            if (drag.mode === 'move') {
                onMoveElement(drag.id, snap(drag.originX + dx, SNAP_GRID, showGrid), snap(drag.originY + dy, SNAP_GRID, showGrid));
            } else if (drag.mode === 'resize' && drag.handle) {
                let w = drag.originWidth || 0;
                let h = drag.originHeight || 0;
                let x = drag.originX;
                let y = drag.originY;
                const handle = drag.handle;
                if (handle.includes('e')) w = Math.max(20, drag.originWidth! + dx);
                if (handle.includes('w')) { w = Math.max(20, drag.originWidth! - dx); x = drag.originX + (drag.originWidth! - w); }
                if (handle.includes('s')) h = Math.max(10, drag.originHeight! + dy);
                if (handle.includes('n')) { h = Math.max(10, drag.originHeight! - dy); y = drag.originY + (drag.originHeight! - h); }
                onResizeElement(drag.id, snap(w, SNAP_GRID, showGrid), snap(h, SNAP_GRID, showGrid), x, y);
            }
        };

        const handlePointerUp = () => {
            if (dragRef.current) { onMoveEnd?.(); }
            dragRef.current = null;
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
        };
    }, [onMoveElement, onResizeElement, onMoveEnd, showGrid]);

    const startDrag = useCallback((element: CanvasElement, event: React.PointerEvent<HTMLDivElement>, mode: 'move' | 'resize', handle?: string) => {
        event.stopPropagation();
        onSelectElement(element.id);
        if (mode === 'move') onMoveStart?.();
        if (mode === 'resize') { event.preventDefault(); onMoveStart?.(); }
        dragRef.current = {
            id: element.id, startX: event.clientX, startY: event.clientY,
            originX: element.x, originY: element.y, zoom, mode, handle,
            originWidth: mode === 'resize' ? element.width : undefined,
            originHeight: mode === 'resize' ? element.height : undefined
        };
    }, [onSelectElement, onMoveStart, zoom]);

    const selectedElement = elements.find((el) => el.id === selectedId);

    return (
        <main
            className="flex-1 overflow-auto bg-[#e8ecf1]"
            data-testid="canvas-stage"
            onClick={(e) => {
                if (e.target === containerRef.current || (e.target as HTMLElement).dataset.canvas === 'true') {
                    onSelectElement(null);
                }
            }}
        >
            <div ref={containerRef} className="min-h-full flex items-start justify-center p-10" data-canvas="true">
                <div
                    className="relative origin-top-left bg-white"
                    data-canvas="true"
                    style={{
                        width: '210mm',
                        height: '297mm',
                        transform: `scale(${zoom / 100})`,
                        transformOrigin: 'top center',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
                        borderRadius: '4px',
                        backgroundImage: showGrid
                            ? 'radial-gradient(circle, #d1d5db 0.8px, transparent 0.8px)'
                            : undefined,
                        backgroundSize: '16px 16px'
                    }}
                    onClick={(e) => {
                        if ((e.target as HTMLElement).dataset.canvas === 'true') onSelectElement(null);
                    }}
                >
                    {logoUrl && (
                        <div className="absolute flex items-center justify-center overflow-hidden rounded border border-dashed border-gray-300" style={{ left: 40, top: 40, width: 100, height: 60 }}>
                            <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                        </div>
                    )}

                    {elements.map((element) => (
                        <CanvasItem
                            key={element.id}
                            element={element}
                            selected={selectedId === element.id}
                            onPointerDown={(e) => startDrag(element, e, 'move')}
                            onResizePointerDown={(handle, e) => startDrag(element, e, 'resize', handle)}
                        />
                    ))}

                    {selectedElement && <SelectionOverlay element={selectedElement} />}
                </div>
            </div>
        </main>
    );
}

function SelectionOverlay({ element }: { element: CanvasElement }) {
    const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'] as const;
    const positions: Record<string, React.CSSProperties> = {
        nw: { top: -5, left: -5, cursor: 'nwse-resize' },
        ne: { top: -5, right: -5, cursor: 'nesw-resize' },
        sw: { bottom: -5, left: -5, cursor: 'nesw-resize' },
        se: { bottom: -5, right: -5, cursor: 'nwse-resize' },
        n: { top: -5, left: '50%', cursor: 'ns-resize' },
        s: { bottom: -5, left: '50%', cursor: 'ns-resize' },
        e: { top: '50%', right: -5, cursor: 'ew-resize' },
        w: { top: '50%', left: -5, cursor: 'ew-resize' }
    };

    return (
        <div className="pointer-events-none absolute" style={{ left: element.x - 1, top: element.y - 1, width: element.width + 2, height: element.height + 2, border: '2px solid #6366f1', borderRadius: '2px' }}>
            {handles.map((handle) => (
                <div
                    key={handle}
                    className="pointer-events-auto absolute z-10"
                    style={{
                        ...positions[handle],
                        width: 10, height: 10,
                        backgroundColor: '#6366f1',
                        border: '2px solid white',
                        borderRadius: '3px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        transform: handle.length === 1 ? 'translate(-50%, -50%)' : undefined
                    }}
                />
            ))}
        </div>
    );
}

function CanvasItem({
    element, selected, onPointerDown, onResizePointerDown
}: {
    element: CanvasElement;
    selected: boolean;
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
    onResizePointerDown: (handle: string, e: React.PointerEvent<HTMLDivElement>) => void;
}) {
    if (element.type === 'line') {
        return (
            <div
                onPointerDown={onPointerDown}
                className="absolute cursor-grab active:cursor-grabbing"
                style={{ left: element.x, top: element.y, width: element.width, height: Math.max(2, element.height), backgroundColor: element.borderColor || element.color || '#1e293b' }}
                data-testid={`canvas-element-${element.id}`}
            />
        );
    }

    if (element.type === 'image') {
        return (
            <div
                onPointerDown={onPointerDown}
                className="absolute flex cursor-grab items-center justify-center overflow-hidden active:cursor-grabbing"
                style={{ left: element.x, top: element.y, width: element.width, height: element.height, backgroundColor: element.backgroundColor, border: selected ? undefined : '1px solid transparent' }}
                data-testid={`canvas-element-${element.id}`}
            >
                {element.src ? (
                    <img src={element.src} alt="" className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400"><ImageIcon size={32} /></div>
                )}
            </div>
        );
    }

    const isTextLike = element.type === 'text' || element.type === 'variable';
    return (
        <div
            onPointerDown={onPointerDown}
            className="absolute flex cursor-grab active:cursor-grabbing"
            style={{
                left: element.x, top: element.y, width: element.width, height: element.height,
                fontSize: element.fontSize,
                fontWeight: element.fontWeight as 'normal' | 'bold' | undefined,
                color: element.color, backgroundColor: element.backgroundColor,
                borderColor: element.borderColor,
                borderWidth: element.type === 'box' && element.borderWidth ? `${element.borderWidth}px` : undefined,
                borderStyle: element.type === 'box' ? 'solid' : undefined,
                borderRadius: element.type === 'box' ? '2px' : undefined,
                alignItems: 'center', padding: '0 8px',
                textAlign: element.textAlign || 'left',
                justifyContent: element.textAlign === 'center' ? 'center' : element.textAlign === 'right' ? 'flex-end' : 'flex-start',
                userSelect: 'none'
            }}
            data-testid={`canvas-element-${element.id}`}
        >
            {isTextLike && <span className="pointer-events-none leading-tight">{element.content}</span>}
        </div>
    );
}
