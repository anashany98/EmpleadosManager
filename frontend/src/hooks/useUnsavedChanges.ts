import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tracks a "dirty" flag (the user has unsaved changes) and warns the user
 * via the native `beforeunload` dialog when they try to leave the page.
 *
 * Returns:
 *  - `isDirty`: true when there are pending changes.
 *  - `markDirty()`: call this from every mutation handler (drag, type, delete).
 *  - `markClean()`: call this after a successful save.
 *  - `confirmDiscard()`: returns true if the user accepts discarding changes
 *    (used for in-app navigation like switching templates).
 */
export function useUnsavedChanges(): {
    isDirty: boolean;
    markDirty: () => void;
    markClean: () => void;
    confirmDiscard: () => boolean;
} {
    const [isDirty, setIsDirty] = useState(false);
    const isDirtyRef = useRef(false);

    const markDirty = useCallback(() => {
        if (!isDirtyRef.current) {
            isDirtyRef.current = true;
            setIsDirty(true);
        }
    }, []);

    const markClean = useCallback(() => {
        if (isDirtyRef.current) {
            isDirtyRef.current = false;
            setIsDirty(false);
        }
    }, []);

    const confirmDiscard = useCallback(() => {
        if (!isDirtyRef.current) return true;
        // eslint-disable-next-line no-alert
        return window.confirm('Tienes cambios sin guardar. ¿Descartarlos?');
    }, []);

    useEffect(() => {
        if (!isDirty) return;

        const handler = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            // Modern browsers ignore the returned string but require returnValue to be set.
            event.returnValue = '';
            return '';
        };

        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);

    return { isDirty, markDirty, markClean, confirmDiscard };
}
