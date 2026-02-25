import { toast } from 'sonner';

export const BASE_URL = import.meta.env.VITE_API_URL || '';
// Avoid double /api if VITE_API_URL already ends with it
export const API_URL = BASE_URL.endsWith('/api') || BASE_URL.endsWith('/api/')
    ? BASE_URL.replace(/\/$/, '')
    : `${BASE_URL.replace(/\/$/, '')}/api`;

// Request options type
interface RequestOptions {
    params?: Record<string, string | number | boolean>;
    responseType?: 'blob' | 'json';
}

const getCookie = (name: string): string => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()!.split(';').shift() || '';
    return '';
};

const getHeaders = (isFormData = false, method: string = 'GET'): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (!isFormData) headers['Content-Type'] = 'application/json';

    const upper = method.toUpperCase();
    if (upper !== 'GET' && upper !== 'HEAD' && upper !== 'OPTIONS') {
        const csrfToken = getCookie('csrf_token');
        if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    }
    return headers;
};

// Queue to hold requests while refreshing
let isRefreshing = false;
interface QueueItem {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
}
let failedQueue: QueueItem[] = [];

const processQueue = (error: Error | null, token: string | null = null): void => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const customFetch = async <T = any>(endpoint: string, options: RequestOptions & { method?: string; body?: unknown } = {}): Promise<T> => {
    const url = `${API_URL}${endpoint}`;

    // Config fetch
    const method = options.method || 'GET';
    const config: RequestInit = {
        method,
        headers: getHeaders(options.body instanceof FormData, method),
        body: options.body instanceof FormData ? options.body : (options.body ? JSON.stringify(options.body) : undefined),
        credentials: 'include'
    };

    try {
        const res = await fetch(url, config);

        // Handle 401 (Unauthorized) - Only if not logging in or refreshing
        if (res.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh') && !endpoint.includes('/auth/me')) {
            if (isRefreshing) {
                // If already refreshing, queue this request
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(() => {
                    return customFetch<T>(endpoint, options);
                }).catch((err) => {
                    throw err;
                }) as Promise<T>;
            }

            isRefreshing = true;
            try {
                // Attempt refresh
                const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include'
                });

                if (!refreshRes.ok) {
                    throw new Error('Refresh failed');
                }

                await refreshRes.json();

                isRefreshing = false;
                processQueue(null, null);

                // Retry original request
                return customFetch<T>(endpoint, options);

            } catch (refreshErr) {
                isRefreshing = false;
                processQueue(refreshErr as Error, null);

                // Complete logout (avoid reload loop if already on auth pages)
                const path = window.location.pathname;
                const isAuthPage = path.startsWith('/login') || path.startsWith('/request-reset') || path.startsWith('/reset-password');
                if (!isAuthPage) {
                    window.location.href = '/login';
                }
                throw refreshErr;
            }
        }

        if (!res.ok) {
            // Generic error handling
            let errMsg = res.statusText;
            try {
                const text = await res.text();
                try {
                    const json = JSON.parse(text);
                    if (json.message) errMsg = json.message;
                    else errMsg = text;
                } catch {
                    errMsg = text;
                }
                throw new Error(text);
            } catch (e: unknown) {
                const error = e as Error;
                let finalMsg = error.message || errMsg;
                try {
                    const json = JSON.parse(finalMsg);
                    if (json.message) finalMsg = json.message;
                } catch { }

                if (res.status === 403) {
                    toast.error('⛔ Acceso denegado: No tienes permiso para esta acción.');
                }

                throw new Error(finalMsg);
            }
        }

        if (options.responseType === 'blob') {
            return res.blob() as Promise<T>;
        }
        return res.json();

    } catch (error) {
        throw error;
    }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const api: {
    get: <T = any>(endpoint: string, options?: RequestOptions) => Promise<T>;
    post: <T = any>(endpoint: string, body?: unknown, options?: RequestOptions) => Promise<T>;
    put: <T = any>(endpoint: string, body?: unknown, options?: RequestOptions) => Promise<T>;
    patch: <T = any>(endpoint: string, body?: unknown, options?: RequestOptions) => Promise<T>;
    delete: <T = any>(endpoint: string) => Promise<T>;
} = {
    get: <T>(endpoint: string, options: RequestOptions = {}) => 
        customFetch<T>(endpoint, { ...options, method: 'GET' }),
    post: <T>(endpoint: string, body?: unknown, options: RequestOptions = {}) => 
        customFetch<T>(endpoint, { ...options, method: 'POST', body }),
    put: <T>(endpoint: string, body?: unknown, options: RequestOptions = {}) => 
        customFetch<T>(endpoint, { ...options, method: 'PUT', body }),
    patch: <T>(endpoint: string, body?: unknown, options: RequestOptions = {}) => 
        customFetch<T>(endpoint, { ...options, method: 'PATCH', body }),
    delete: <T>(endpoint: string) => 
        customFetch<T>(endpoint, { method: 'DELETE' })
};
