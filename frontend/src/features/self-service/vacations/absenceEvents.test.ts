import { describe, expect, it, vi } from 'vitest';
import { ABSENCE_UPDATED_EVENT, notifyAbsenceUpdated } from './absenceEvents';

describe('absenceEvents', () => {
    it('notifica a las vistas relacionadas después de una mutación', () => {
        const listener = vi.fn();
        window.addEventListener(ABSENCE_UPDATED_EVENT, listener);

        notifyAbsenceUpdated({
            employeeId: 'employee-1',
            requestId: 'request-1',
            action: 'STATUS_CHANGED'
        });

        expect(listener).toHaveBeenCalledOnce();
        expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
            employeeId: 'employee-1',
            requestId: 'request-1',
            action: 'STATUS_CHANGED'
        });

        window.removeEventListener(ABSENCE_UPDATED_EVENT, listener);
    });
});
