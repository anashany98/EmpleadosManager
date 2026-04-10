import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TimeTrackerWidget from './TimeTrackerWidget';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
    api: {
        get: vi.fn(),
        post: vi.fn()
    }
}));

vi.mock('../hooks/useNetworkStatus', () => ({
    useNetworkStatus: () => true
}));

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn()
    }
}));

describe('TimeTrackerWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();

        Object.defineProperty(navigator, 'geolocation', {
            configurable: true,
            value: {
                getCurrentPosition: (success: PositionCallback) => success({
                    coords: {
                        latitude: 39.5696,
                        longitude: 2.6502
                    }
                } as GeolocationPosition)
            }
        });

        vi.mocked(api.get).mockResolvedValue({
            success: true,
            data: {
                status: 'OFF',
                lastEntry: null
            }
        } as never);

        vi.mocked(api.post).mockResolvedValue({
            success: true,
            data: {
                entry: {
                    id: 'entry-1',
                    type: 'IN',
                    timestamp: new Date().toISOString()
                }
            }
        } as never);
    });

    it('sends a persistent clientRequestId when clocking online', async () => {
        render(<TimeTrackerWidget />);

        await screen.findByText('FUERA DE TURNO');

        fireEvent.click(screen.getByRole('button', { name: /entrar a trabajar/i }));

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith(
                '/time-entries/clock',
                expect.objectContaining({
                    type: 'IN',
                    clientRequestId: expect.any(String)
                })
            );
        });
    });

    it('queues the same clientRequestId when the online request fails with a network error', async () => {
        vi.mocked(api.post).mockRejectedValueOnce(new Error('Failed to fetch'));

        render(<TimeTrackerWidget />);

        await screen.findByText('FUERA DE TURNO');

        fireEvent.click(screen.getByRole('button', { name: /entrar a trabajar/i }));

        await waitFor(() => {
            const queue = JSON.parse(localStorage.getItem('offline_clock_queue_v1') || '[]');
            expect(queue).toHaveLength(1);
            expect(queue[0].payload.clientRequestId).toEqual(expect.any(String));
        });
    });
});
