import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUnsavedChanges } from './useUnsavedChanges';

describe('useUnsavedChanges', () => {
    let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
    let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;
    let preventDefaultSpy: () => void;

    beforeEach(() => {
        addEventListenerSpy = vi.spyOn(window, 'addEventListener');
        removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
        preventDefaultSpy = vi.fn() as unknown as () => void;
    });

    afterEach(() => {
        addEventListenerSpy.mockRestore();
        removeEventListenerSpy.mockRestore();
    });

    it('starts clean and never registers beforeunload', () => {
        const { result } = renderHook(() => useUnsavedChanges());
        expect(result.current.isDirty).toBe(false);
        expect(addEventListenerSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));
    });

    it('marks dirty on first mutation and clears on demand', () => {
        const { result } = renderHook(() => useUnsavedChanges());

        act(() => result.current.markDirty());
        expect(result.current.isDirty).toBe(true);

        act(() => result.current.markClean());
        expect(result.current.isDirty).toBe(false);
    });

    it('registers a beforeunload listener while dirty', () => {
        const { result } = renderHook(() => useUnsavedChanges());

        act(() => result.current.markDirty());

        const registration = addEventListenerSpy.mock.calls.find(([eventName]: [string, EventListener]) => eventName === 'beforeunload');
        expect(registration).toBeDefined();
    });

    it('prevents unload when the user tries to leave with pending changes', () => {
        const { result } = renderHook(() => useUnsavedChanges());

        act(() => result.current.markDirty());

        const event = new Event('beforeunload') as BeforeUnloadEvent;
        event.preventDefault = preventDefaultSpy;
        Object.defineProperty(event, 'returnValue', { value: '', writable: true, configurable: true });

        const registration = addEventListenerSpy.mock.calls.find(([eventName]: [string, EventListener]) => eventName === 'beforeunload');
        const handler = registration?.[1] as EventListener;
        expect(handler).toBeTypeOf('function');

        act(() => {
            handler(event);
        });

        expect(preventDefaultSpy).toHaveBeenCalled();
        expect((event as BeforeUnloadEvent).returnValue).toBe('');
    });

    it('confirmDiscard returns true when nothing is dirty', () => {
        const { result } = renderHook(() => useUnsavedChanges());
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        expect(result.current.confirmDiscard()).toBe(true);
        expect(confirmSpy).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });

    it('confirmDiscard asks the user when there are pending changes', () => {
        const { result } = renderHook(() => useUnsavedChanges());
        act(() => result.current.markDirty());

        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        expect(result.current.confirmDiscard()).toBe(false);
        expect(confirmSpy).toHaveBeenCalled();
        confirmSpy.mockRestore();
    });
});
