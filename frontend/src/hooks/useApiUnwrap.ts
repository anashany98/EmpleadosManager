import { useCallback } from 'react';

/**
 * Extrae los datos de la respuesta de la API. Centraliza el patrón
 * `r?.data?.data ?? r?.data ?? r` que estaba duplicado en 50+ sitios del
 * frontend. Es la versión plana (sin hooks) para módulos que no son
 * componentes; los componentes la usan a través de useApiUnwrap().
 */
export function unwrapResponse<T = unknown>(r: unknown): T {
    // Equivalente tipado de `r?.data?.data ?? r?.data ?? r` sin `any`:
    // desempaqueta como mucho dos niveles de envelope `{ data }`.
    const outer = r as { data?: unknown } | null | undefined;
    const first = outer?.data;
    if (first === undefined || first === null) return r as T;
    const second = (first as { data?: unknown } | null | undefined)?.data;
    return (second === undefined || second === null ? first : second) as T;
}

/**
 * Hook que devuelve un helper para extraer datos de la respuesta de la API.
 *
 * Uso:
 *   const unwrap = useApiUnwrap();
 *   const obras = unwrap(await api.get('/obras'));
 */
export function useApiUnwrap() {
    return useCallback(<T = unknown>(r: unknown): T => unwrapResponse<T>(r), []);
}
