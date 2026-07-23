import { useCallback } from 'react';

/**
 * Hook que devuelve un helper para extraer datos de la respuesta de la API.
 * Centraliza el patrón `r?.data?.data ?? r?.data ?? r` que estaba duplicado
 * en 50+ sitios del frontend.
 *
 * Uso:
 *   const unwrap = useApiUnwrap();
 *   const obras = unwrap(await api.get('/obras'));
 */
export function useApiUnwrap() {
    return useCallback(<T = unknown>(r: any): T => {
        return (r?.data?.data ?? r?.data ?? r) as T;
    }, []);
}
