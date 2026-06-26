import { useCallback, useEffect, useRef, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import type { CanvasElement } from './types';

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
    innerRef?: React.MutableRefObject<HTMLDivElement | null>;
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

const SNAP_THRESHOLD = 5;

function snapToGrid(value: number, gridSize: number, enabled: boolean): number {
    if (!enabled) return value;
    const half = gridSize / 2;
    return Math.round((value + half) / gridSize) * gridSize - half;
}

export function CanvasStage({
    elements,
    selectedId,
    zoom,
    showGrid,
    logoUrl,
    onSelectElement,
    onMoveElement,
    onResizeElement,
    onMoveStart,
    onMoveEnd,
    innerRef
}: CanvasStageProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const dragStateRef = useRef<DragState | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const setRefs = useCallback(
        (node: HTMLDivElement | null) => {
            containerRef.current = node;
            if (innerRef) innerRef.current = node;
        },
        [innerRef]
    );

    useEffect(() => {
        const handlePointerMove = (event: PointerEvent) => {
            const drag = dragStateRef.current;
            if (!drag) return;

            const zoomFactor = drag.zoom / 100;
            const deltaX = (event.clientX - drag.startX) / zoomFactor;
            const deltaY = (event.clientY - drag.startY) / zoomFactor;

            if (drag.mode === 'move') {
                let newX = drag.originX + deltaX;
                let newY = drag.originY + deltaY;
                newX = snapToGrid(newX, 10, showGrid);
                newY = snapToGrid(newY, 10, showGrid);
                onMoveElement(drag.id, newX, newY);
            } else if (drag.mode === 'resize' && drag.handle) {
                let newW = drag.originWidth || 0;
                let newH = drag.originHeight || 0;
                let newX = drag.originX;
                let newY = drag.originY;

                const handle = drag.handle;
                if (handle.includes('e')) newW = Math.max(20, drag.originWidth! + deltaX);
                if (handle.includes('w')) {
                    newW = Math.max(20, drag.originWidth! - deltaX);
                    newX = drag.originX + (drag.originWidth! - newW);
                }
                if (handle.includes('s')) newH = Math.max(10, drag.originHeight! + deltaY);
                if (handle.includes('n')) {
                    newH = Math.max(10, drag.originHeight! - deltaY);
                    newY = drag.originY + (drag.originHeight! - newH);
                }

                newW = snapToGrid(newW, 10, showGrid);
                newH = snapToGrid(newH, 10, showGrid);

                onResizeElement(drag.id, newW, newH, newX, newY);
            }
        };

        const handlePointerUp = () => {
            if (dragStateRef.current) {
                onMoveEnd?.();
                setIsDragging(false);
            }
            dragStateRef.current = null;
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

    const handleElementPointerDown = (element: CanvasElement, event: React.PointerEvent<HTMLDivElement>) => {
        event.stopPropagation();
        onSelectElement(element.id);
        onMoveStart?.();
        setIsDragging(true);
        dragStateRef.current = {
            id: element.id,
            startX: event.clientX,
            startY: event.clientY,
            originX: element.x,
            originY: element.y,
            zoom,
            mode: 'move'
        };
    };

    const handleResizePointerDown = (element: CanvasElement, handle: string, event: React.PointerEvent<HTMLDivElement>) => {
        event.stopPropagation();
        event.preventDefault();
        onMoveStart?.();
        setIsDragging(true);
        dragStateRef.current = {
            id: element.id,
            startX: event.clientX,
            startY: event.clientY,
            originX: element.x,
            originY: element.y,
            zoom,
            mode: 'resize',
            handle,
            originWidth: element.width,
            originHeight: element.height
        };
    };

    const selectedElement = elements.find((el) => el.id === selectedId);

    return (
        <main
            className="flex-1 overflow-auto bg-[#1a1a2e]"
            data-testid="canvas-stage"
            onClick={(e) => {
                if (e.target === containerRef.current || (e.target as HTMLElement).dataset.canvas === 'true') {
                    onSelectElement(null);
                }
            }}
        >
            <div
                ref={setRefs}
                className="min-h-full p-8"
                data-canvas="true"
            >
                <div
                    className="relative mx-auto origin-top-left bg-white shadow-2xl"
                    data-canvas="true"
                    style={{
                        width: '210mm',
                        height: '297mm',
                        transform: `scale(${zoom / 100})`,
                        transformOrigin: 'top left',
                        backgroundImage: showGrid
                            ? 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)'
                            : undefined,
                        backgroundSize: '20px 20px'
                    }}
                    onClick={(e) => {
                        if ((e.target as HTMLElement).dataset.canvas === 'true') onSelectElement(null);
                    }}
                >
                    {logoUrl && (
                        <div
                            className="absolute flex items-center justify-center overflow-hidden rounded border border-dashed border-slate-200"
                            style={{ left: 40, top: 40, width: 100, height: 60 }}
                        >
                            <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                        </div>
                    )}
                    {elements.map((element) => (
                        <CanvasItem
                            key={element.id}
                            element={element}
                            selected={selectedId === element.id}
                            onPointerDown={(e) => handleElementPointerDown(element, e)}
                            onResizePointerDown={(handle, e) => handleResizePointerDown(element, handle, e)}
                        />
                    ))}

                    {selectedElement && (
                        <SelectionOverlay element={selectedElement} />
                    )}
                </div>
            </div>
        </main>
    );
}

function SelectionOverlay({ element }: { element: CanvasElement }) {
    const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
    const handlePositions: Record<string, { top?: string; bottom?: string; left?: string; right?: string; cursor: string }> = {
        nw: { top: '-4px', left: '-4px', cursor: 'nwse-resize' },
        ne: { top: '-4px', right: '-4px', cursor: 'nesw-resize' },
        sw: { bottom: '-4px', left: '-4px', cursor: 'nesw-resize' },
        se: { bottom: '-4px', right: '-4px', cursor: 'nwse-resize' },
        n: { top: '-4px', left: '50%', cursor: 'ns-resize' },
        s: { bottom: '-4px', left: '50%', cursor: 'ns-resize' },
        e: { top: '50%', right: '-4px', cursor: 'ew-resize' },
        w: { top: '50%', left: '-4px', cursor: 'ew-resize' },
    };

    return (
        <div
            className="pointer-events-none absolute border-2 border-blue-500"
            style={{
                left: element.x - 1,
                top: element.y - 1,
                width: element.width + 2,
                height: element.height + 2,
            }}
        >
            {handles.map((handle) => {
                const pos = handlePositions[handle];
                return (
                    <div
                        key={handle}
                        className="pointer-events-auto absolute z-10"
                        style={{
                            ...pos,
                            width: '8px',
                            height: '8px',
                            backgroundColor: '#3b82f6',
                            border: '1.5px solid white',
                            borderRadius: '2px',
                            cursor: pos.cursor,
                            transform: handle.length === 1 ? 'translate(-50%, -50%)' : undefined,
                        }}
                    />
                );
            })}
        </div>
    );
}

function CanvasItem({
    element,
    selected,
    onPointerDown,
    onResizePointerDown
}: {
    element: CanvasElement;
    selected: boolean;
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
    onResizePointerDown: (handle: string, event: React.PointerEvent<HTMLDivElement>) => void;
}) {
    if (element.type === 'line') {
        return (
            <div
                onPointerDown={onPointerDown}
                className="absolute cursor-grab active:cursor-grabbing"
                style={{
                    left: element.x,
                    top: element.y,
                    width: element.width,
                    height: Math.max(2, element.height),
                    backgroundColor: element.borderColor || element.color || '#1e293b'
                }}
                data-testid={`canvas-element-${element.id}`}
            />
        );
    }

    if (element.type === 'image') {
        return (
            <div
                onPointerDown={onPointerDown}
                className="absolute flex cursor-grab items-center justify-center overflow-hidden active:cursor-grabbing"
                style={{
                    left: element.x,
                    top: element.y,
                    width: element.width,
                    height: element.height,
                    backgroundColor: element.backgroundColor,
                    border: selected ? undefined : '1px solid transparent'
                }}
                data-testid={`canvas-element-${element.id}`}
            >
                {element.src ? (
                    <img src={element.src} alt="" className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
                        <ImageIcon size={32} />
                    </div>
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
                left: element.x,
                top: element.y,
                width: element.width,
                height: element.height,
                fontSize: element.fontSize,
                fontWeight: element.fontWeight as 'normal' | 'bold' | undefined,
                color: element.color,
                backgroundColor: element.backgroundColor,
                borderColor: element.borderColor,
                borderWidth: element.type === 'box' && element.borderWidth ? `${element.borderWidth}px` : undefined,
                borderStyle: element.type === 'box' ? 'solid' : undefined,
                borderRadius: element.type === 'box' ? '0px' : undefined,
                alignItems: 'center',
                padding: '0 8px',
                textAlign: element.textAlign || 'left',
                justifyContent:
                    element.textAlign === 'center'
                        ? 'center'
                        : element.textAlign === 'right'
                          ? 'flex-end'
                          : 'flex-start',
                userSelect: 'none'
            }}
            data-testid={`canvas-element-${element.id}`}
        >
            {isTextLike && <span className="pointer-events-none">{element.content}</span>}
        </div>
    );
}
