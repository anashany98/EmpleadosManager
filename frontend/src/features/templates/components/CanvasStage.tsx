import { useCallback, useEffect, useRef } from 'react';
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
    onMoveStart?: () => void;
    onMoveEnd?: () => void;
    /** Optional ref handle for the canvas DOM node (used by PreviewPane). */
    innerRef?: React.MutableRefObject<HTMLDivElement | null>;
}

interface DragState {
    id: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    zoom: number;
}

export function CanvasStage({
    elements,
    selectedId,
    zoom,
    showGrid,
    logoUrl,
    onSelectElement,
    onMoveElement,
    onMoveStart,
    onMoveEnd,
    innerRef
}: CanvasStageProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const dragStateRef = useRef<DragState | null>(null);

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
            const deltaX = (event.clientX - drag.startX) / (drag.zoom / 100);
            const deltaY = (event.clientY - drag.startY) / (drag.zoom / 100);
            onMoveElement(drag.id, drag.originX + deltaX, drag.originY + deltaY);
        };
        const handlePointerUp = () => {
            if (dragStateRef.current) {
                onMoveEnd?.();
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
    }, [onMoveElement, onMoveEnd]);

    const handlePointerDown = (element: CanvasElement, event: React.PointerEvent<HTMLDivElement>) => {
        event.stopPropagation();
        onSelectElement(element.id);
        onMoveStart?.();
        dragStateRef.current = {
            id: element.id,
            startX: event.clientX,
            startY: event.clientY,
            originX: element.x,
            originY: element.y,
            zoom
        };
    };

    return (
        <main
            className="flex-1 overflow-auto bg-slate-100 p-8"
            data-testid="canvas-stage"
            onClick={(e) => {
                if (e.target === containerRef.current) onSelectElement(null);
            }}
        >
            <div
                ref={setRefs}
                className="relative mx-auto origin-top-left bg-white shadow-lg"
                style={{
                    width: '210mm',
                    height: '297mm',
                    backgroundColor: 'white',
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'top left',
                    backgroundImage: showGrid
                        ? 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)'
                        : undefined,
                    backgroundSize: '20px 20px'
                }}
                onClick={(e) => {
                    if (e.target === containerRef.current) onSelectElement(null);
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
                        onPointerDown={(event) => handlePointerDown(element, event)}
                    />
                ))}
            </div>
        </main>
    );
}

function CanvasItem({
    element,
    selected,
    onPointerDown
}: {
    element: CanvasElement;
    selected: boolean;
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
    const isSelectedRing = selected ? 'ring-2 ring-blue-500 ring-offset-2' : '';

    if (element.type === 'line') {
        return (
            <div
                onPointerDown={onPointerDown}
                className={`absolute cursor-grab ${isSelectedRing}`}
                style={{
                    left: element.x,
                    top: element.y,
                    width: element.width,
                    height: Math.max(1, element.height),
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
                className={`absolute flex cursor-grab items-center justify-center overflow-hidden ${isSelectedRing}`}
                style={{
                    left: element.x,
                    top: element.y,
                    width: element.width,
                    height: element.height,
                    backgroundColor: element.backgroundColor
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
            className={`absolute flex cursor-grab transition-shadow ${isSelectedRing}`}
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
            {isTextLike && <span>{element.content}</span>}
        </div>
    );
}
