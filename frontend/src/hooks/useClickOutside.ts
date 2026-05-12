import { useEffect, useRef } from 'react';

/**
 * Hook that detects clicks outside of a specified element.
 * Returns a ref that should be attached to the element to monitor.
 * The callback is called when a click occurs outside the element.
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
    callback: (event: MouseEvent | TouchEvent) => void
): React.RefObject<T> {
    const ref = useRef<T>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                callback(event);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [callback]);

    return ref;
}