import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('api client refresh flow', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('refreshes and retries /auth/me when the access token has expired', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Token expirado' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'success', data: {} }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                data: { id: 'user-1', email: 'admin@company.test', role: 'admin', companyId: 'company-1' }
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }));

        vi.stubGlobal('fetch', fetchMock);

        const { api } = await import('./client');
        const result = await api.get('/auth/me');

        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('/auth/me'),
            expect.objectContaining({ method: 'GET', credentials: 'include' })
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('/auth/refresh'),
            expect.objectContaining({ method: 'POST', credentials: 'include' })
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            3,
            expect.stringContaining('/auth/me'),
            expect.objectContaining({ method: 'GET', credentials: 'include' })
        );
        expect(result).toEqual({
            data: { id: 'user-1', email: 'admin@company.test', role: 'admin', companyId: 'company-1' }
        });
    });
});
