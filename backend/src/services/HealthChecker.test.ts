import { describe, expect, it, vi, beforeEach } from 'vitest';
import v8 from 'v8';
import { HealthChecker } from './HealthChecker';

/**
 * MED-009: el bug original del ternario de umbrales de memoria
 * era:
 *   `usage > 90 ? 'degraded' : usage > 95 ? 'error' : 'ok'`
 * que hace `error` INALCANZABLE (si usage > 95 entonces usage >
 * 90 es true, la primera rama gana). Estos tests verifican que
 * los tres estados son alcanzables en sus umbrales.
 */
describe('HealthChecker.checkMemory (MED-009)', () => {
    let checker: HealthChecker;

    beforeEach(() => {
        vi.restoreAllMocks();
        checker = new HealthChecker();
    });

    /**
     * Helper: mockea `v8.getHeapStatistics` para devolver un
     * heap size limit y used heap concretos. Devuelve el
     * % resultante (que debería caer en uno de los
     * umbrales).
     */
    const mockHeap = (usagePercent: number) => {
        const heapLimitBytes = 1024 * 1024 * 1024; // 1GB
        const usedBytes = Math.floor(heapLimitBytes * (usagePercent / 100));
        const totalBytes = Math.floor(usedBytes * 1.2); // 20% reservado de más
        vi.spyOn(v8, 'getHeapStatistics').mockReturnValue({
            heap_size_limit: heapLimitBytes,
            total_heap_size: totalBytes,
            used_heap_size: usedBytes,
            total_available_size: heapLimitBytes - usedBytes,
            // El resto de campos obligatorios los rellenamos con
            // 0 — el helper no los usa.
        } as ReturnType<typeof v8.getHeapStatistics>);
    };

    it('returns "ok" when usage is well below 90%', () => {
        mockHeap(50);
        const result = checker.checkMemory();
        expect(result.status).toBe('ok');
        expect(result.message).toBeUndefined();
    });

    it('returns "ok" at exactly 89% (just under the first threshold)', () => {
        mockHeap(89);
        const result = checker.checkMemory();
        expect(result.status).toBe('ok');
    });

    it('returns "degraded" at 91% (between 90% and 95%)', () => {
        mockHeap(91);
        const result = checker.checkMemory();
        expect(result.status).toBe('degraded');
        expect(result.message).toContain('91.0%');
    });

    it('REGRESSION: returns "error" at 96% (was unreachable before the fix)', () => {
        // Antes del fix, este test daba 'degraded' porque
        // `usage > 90 ? degraded : ...` se evaluaba primero.
        // Ahora el orden es `usage > 95 ? error : ...`.
        mockHeap(96);
        const result = checker.checkMemory();
        expect(result.status).toBe('error');
        expect(result.message).toContain('96.0%');
    });

    it('returns "error" at exactly 96% (just over the second threshold)', () => {
        mockHeap(96);
        const result = checker.checkMemory();
        expect(result.status).toBe('error');
    });

    it('reports the heap limit in the message (so SRE can correlate with Node flags)', () => {
        mockHeap(91);
        const result = checker.checkMemory();
        // El mensaje debe mencionar el heap limit en MB para
        // que el operario sepa cuánto espacio le queda.
        expect(result.message).toMatch(/\d+MB \/ \d+MB heap limit/);
    });

    it('computes freeMB as max(0, limit - used)', () => {
        mockHeap(75);
        const result = checker.checkMemory();
        // 1GB limit, 75% used → 25% free = 256MB
        expect(result.freeMB).toBe(256);
        expect(result.usedMB).toBe(768);
    });
});
