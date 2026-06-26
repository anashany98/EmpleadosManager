import { useCallback, useState } from 'react';
import type { CanvasElement } from '../components/types';

const MAX_HISTORY = 50;

export function useCanvasHistory(initial: CanvasElement[]) {
    const [elements, setElements] = useState<CanvasElement[]>(initial);
    const [history, setHistory] = useState<CanvasElement[][]>([initial]);
    const [index, setIndex] = useState(0);

    const pushHistory = useCallback((next: CanvasElement[]) => {
        setHistory((prev) => {
            const trimmed = prev.slice(0, index + 1);
            const updated = [...trimmed, next];
            if (updated.length > MAX_HISTORY) updated.shift();
            return updated;
        });
        setIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
    }, [index]);

    const set = useCallback((updater: CanvasElement[] | ((prev: CanvasElement[]) => CanvasElement[])) => {
        setElements((prev) => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            pushHistory(next);
            return next;
        });
    }, [pushHistory]);

    const setImmediate = useCallback((next: CanvasElement[]) => {
        setElements(next);
    }, []);

    const reset = useCallback((next: CanvasElement[]) => {
        setElements(next);
        setHistory([next]);
        setIndex(0);
    }, []);

    const undo = useCallback((): CanvasElement[] | null => {
        if (index <= 0) return null;
        const newIndex = index - 1;
        const prev = history[newIndex];
        setElements(prev);
        setIndex(newIndex);
        return prev;
    }, [history, index]);

    const redo = useCallback((): CanvasElement[] | null => {
        if (index >= history.length - 1) return null;
        const newIndex = index + 1;
        const next = history[newIndex];
        setElements(next);
        setIndex(newIndex);
        return next;
    }, [history, index]);

    return {
        elements,
        set,
        setImmediate,
        reset,
        canUndo: index > 0,
        canRedo: index < history.length - 1,
        undo,
        redo
    };
}
