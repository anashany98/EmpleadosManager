export function normalizeApiCollection<T>(response: unknown): T[] {
    if (Array.isArray(response)) return response as T[];

    const data = (response as { data?: unknown } | null)?.data;
    if (Array.isArray(data)) return data as T[];

    const nestedData = (data as { data?: unknown } | null)?.data;
    if (Array.isArray(nestedData)) return nestedData as T[];

    return [];
}

export function normalizeApiItem<T>(response: unknown): T | null {
    if (!response || typeof response !== 'object') return null;

    const data = (response as { data?: unknown }).data;
    if (data && typeof data === 'object' && !Array.isArray(data)) return data as T;

    return response as T;
}
