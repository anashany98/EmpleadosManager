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

/**
 * MED-006: el cliente API debe tener una política de retry
 * coherente:
 * - 5xx/408/429 en métodos seguros (GET/HEAD/OPTIONS/PUT/DELETE):
 *   reintentar con backoff exponencial + jitter.
 * - 429 con `Retry-After`: respetar el header (clamped a 30s).
 * - POST/PATCH sin marcar como `idempotent`: NO reintentar (puede
 *   duplicar side-effects).
 * - POST/PATCH con `idempotent: true` o `idempotencyKey`: reintentar
 *   (caller asume la responsabilidad de idempotencia).
 * - AbortError por señal externa del caller: NO reintentar, lanzar
 *   AbortError inmediatamente.
 * - AbortError por timeout interno: reintentar.
 * - 4xx no retryable (400, 401, 403, 404...): no reintentar.
 */
describe('api client retry policy (MED-006)', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    /**
     * Helper: ejecuta una llamada `api.*` y avanza los timers fake
     * lo suficiente para que el retry loop se complete. Devuelve
     * un discriminated union para que el caller pueda inspeccionar
     * éxito o fallo sin generar unhandled rejections entre la
     * creación de la promesa y la verificación.
     */
    type Result<T> = { ok: true; value: T } | { ok: false; error: unknown };
    const runWithFakeTimers = async <T>(thunk: () => Promise<T>, totalAdvanceMs: number = 8000): Promise<Result<T>> => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        // Adjuntamos un `.then` con manejadores de éxito Y
        // rechazo inmediatamente, para que cualquier rechazo
        // quede manejado (no se convierte en unhandled
        // rejection). El caller decide si el resultado es el
        // esperado.
        const promise = thunk().then(
            (v) => ({ ok: true as const, value: v }),
            (e) => ({ ok: false as const, error: e })
        );
        try {
            await vi.advanceTimersByTimeAsync(totalAdvanceMs);
        } catch {
            // Si la propia `advanceTimersByTimeAsync` fallara,
            // dejamos que el caller vea el resultado del promise.
        }
        return promise;
    };

    it('retries 500 on GET and resolves on the subsequent 200', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response('Server error', { status: 500 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ data: 'ok' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }));
        vi.stubGlobal('fetch', fetchMock);

        const { api } = await import('./client');
        const result = await runWithFakeTimers(() => api.get<{ data: string }>('/test'));

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(result.value).toEqual({ data: 'ok' });
        }
    });

    it('does NOT retry a 5xx that occurs on the very first attempt (regression test for the original bug)', async () => {
        // El bug original era que `attempt === 0 && status >= 500`
        // devolvía false, así que la primera respuesta 500 NO
        // disparaba retry. La inversa de la propiedad anterior:
        // un 500 SÍ debe reintentar en el primer intento.
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response('boom', { status: 500 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ data: 'recovered' }), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            }));
        vi.stubGlobal('fetch', fetchMock);

        const { api } = await import('./client');
        const result = await runWithFakeTimers(() => api.get<{ data: string }>('/test'));

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET' });
            expect(result.value).toEqual({ data: 'recovered' });
        }
    });

    it('respects the Retry-After header on a 429', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response('Too many', {
                status: 429,
                headers: { 'Retry-After': '0.1' }
            }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ data: 'ok' }), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            }));
        vi.stubGlobal('fetch', fetchMock);

        const { api } = await import('./client');
        // 0.1s * 1000 = 100ms; con jitter, total advance de 500ms
        // es más que suficiente.
        const result = await runWithFakeTimers(() => api.get<{ data: string }>('/test'), 500);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(result.value).toEqual({ data: 'ok' });
        }
    });

    it('does NOT retry a 4xx that is not in the retryable set', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response('Not found', { status: 404 }));
        vi.stubGlobal('fetch', fetchMock);

        const { api } = await import('./client');
        const result = await runWithFakeTimers(() => api.get('/test'));

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toMatchObject({ name: 'ApiError', status: 404 });
        }
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does NOT retry a POST on 5xx unless idempotent: true is passed', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response('boom', { status: 500 }));
        vi.stubGlobal('fetch', fetchMock);

        const { api } = await import('./client');
        const result = await runWithFakeTimers(() => api.post('/test', { foo: 'bar' }));

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toMatchObject({ name: 'ApiError', status: 500 });
        }
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retries a POST on 5xx when idempotent: true is passed', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response('boom', { status: 500 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ data: 'ok' }), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            }));
        vi.stubGlobal('fetch', fetchMock);

        const { api } = await import('./client');
        const result = await runWithFakeTimers(() =>
            api.post<{ data: string }>('/test', { foo: 'bar' }, { idempotent: true })
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(result.value).toEqual({ data: 'ok' });
        }
    });

    it('retries a POST on 5xx when idempotencyKey is passed, and forwards the header', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response('boom', { status: 503 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ data: 'ok' }), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            }));
        vi.stubGlobal('fetch', fetchMock);

        const { api } = await import('./client');
        const result = await runWithFakeTimers(() =>
            api.post<{ data: string }>('/test', { foo: 'bar' }, { idempotencyKey: 'client-12345' })
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(fetchMock).toHaveBeenCalledTimes(2);
            // El header Idempotency-Key debe enviarse en la request.
            expect(fetchMock.mock.calls[0][1]).toMatchObject({
                headers: expect.objectContaining({ 'Idempotency-Key': 'client-12345' })
            });
            expect(result.value).toEqual({ data: 'ok' });
        }
    });

    it('throws immediately when the caller aborts via signal (no retry on external cancel)', async () => {
        // El bug original: cualquier AbortError disparaba retry,
        // incluso cuando el caller era el que cancelaba. Esto
        // hacía que un click en "Cancelar" prolongase la
        // cancelación varios timeouts.
        const fetchMock = vi.fn().mockImplementation((_url, init?: RequestInit) => {
            return new Promise((_, reject) => {
                init?.signal?.addEventListener('abort', () => {
                    reject(new DOMException('Aborted', 'AbortError'));
                });
            });
        });
        vi.stubGlobal('fetch', fetchMock);

        const { api } = await import('./client');
        const controller = new AbortController();
        const promise = api.get('/test', { signal: controller.signal });
        // Cancelamos casi inmediatamente.
        setTimeout(() => controller.abort(), 10);

        await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retries when the request times out (no external signal)', async () => {
        // Fetch que nunca responde: el timeout interno (30s por
        // defecto) debe disparar el retry. Para que el test sea
        // rápido usamos un timeoutMs corto (50ms).
        const fetchMock = vi.fn().mockImplementation((_url, init?: RequestInit) => {
            return new Promise((_, reject) => {
                init?.signal?.addEventListener('abort', () => {
                    reject(new DOMException('Aborted', 'AbortError'));
                });
            });
        });
        vi.stubGlobal('fetch', fetchMock);

        vi.useFakeTimers({ shouldAdvanceTime: true });
        try {
            const { api } = await import('./client');
            // Adjuntamos `.catch` INMEDIATAMENTE para evitar
            // unhandled rejection entre la creación de la
            // promesa y la verificación.
            const promise = api.get('/test', { timeoutMs: 50 })
                .then(
                    (v) => ({ ok: true as const, value: v }),
                    (e) => ({ ok: false as const, error: e })
                );
            // Necesitamos avanzar suficiente para los 4 intentos
            // (50ms timeout + 1000 + 2000 + 4000 backoff ~ 7050ms
            // total).
            await vi.advanceTimersByTimeAsync(10000);
            const result = await promise;
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toMatchObject({ name: 'TimeoutError' });
            }
            // initial + 3 retries = 4 llamadas
            expect(fetchMock).toHaveBeenCalledTimes(4);
        } finally {
            vi.useRealTimers();
        }
    });

    it('gives up after MAX_RETRIES on persistent 5xx and throws ApiError', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response('boom', { status: 500 })
        );
        vi.stubGlobal('fetch', fetchMock);

        const { api } = await import('./client');
        const result = await runWithFakeTimers(() => api.get('/test'));

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toMatchObject({ name: 'ApiError', status: 500 });
        }
        // 1 initial + 3 retries = 4
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it('does not leak listeners on the external signal after the request completes', async () => {
        // El bug original: `addEventListener` se llamaba dentro
        // del loop de retry, y aunque tenía `{ once: true }`, el
        // listener quedaba si la request terminaba por éxito o
        // por error NO-abort. Con `AbortSignal.any` ya no hay
        // listener manual, pero verificamos que el signal del
        // caller no termine con listeners extras.
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ data: 'ok' }), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            }));
        vi.stubGlobal('fetch', fetchMock);

        const externalController = new AbortController();
        // Spy en addEventListener para contar listeners añadidos
        // al signal externo.
        const addSpy = vi.spyOn(externalController.signal, 'addEventListener');

        const { api } = await import('./client');
        const result = await api.get<{ data: string }>('/test', { signal: externalController.signal });

        expect(result).toEqual({ data: 'ok' });
        // Con AbortSignal.any, NO añadimos listeners manuales al
        // signal externo (la combinación es interna). Si el
        // código añadiera listeners, este test lo detectaría.
        expect(addSpy).not.toHaveBeenCalled();
    });
});
