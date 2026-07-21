import { toast } from 'sonner';

export const BASE_URL = import.meta.env.VITE_API_URL || '';
export const API_URL = BASE_URL.endsWith('/api') || BASE_URL.endsWith('/api/')
    ? BASE_URL.replace(/\/$/, '')
    : `${BASE_URL.replace(/\/$/, '')}/api`;

const DEFAULT_REQUEST_TIMEOUT = 30000;
// File uploads (Excel/CSV) need a longer timeout because the backend
// has to stream the body, validate the magic bytes, parse the
// workbook, and run the preview/import pass before responding. 5
// minutes is well above the worst-case observed time for a 25MB
// file with ~5000 rows on the deployed Coolify instance.
const UPLOAD_REQUEST_TIMEOUT = 5 * 60 * 1000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

export class NetworkError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NetworkError';
    }
}

export class TimeoutError extends Error {
    constructor(message: string = 'Request timed out') {
        super(message);
        this.name = 'TimeoutError';
    }
}

export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

/**
 * F1: Extract a user-friendly error message from any error type.
 * Replaces the broken `error.response?.data?.error` pattern (axios shape)
 * that no longer works with the native fetch client.
 */
export function getErrorMessage(err: unknown, fallback = 'Error inesperado'): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof TimeoutError) return 'La petición ha expirado. Inténtalo de nuevo.';
    if (err instanceof NetworkError) return 'Error de red. Comprueba tu conexión.';
    if (err instanceof Error) return err.message;
    return fallback;
}

export interface RequestOptions {
    params?: Record<string, string | number | boolean | undefined | null>;
    responseType?: 'blob' | 'json';
    /**
     * Request timeout in milliseconds. If omitted, the default is
     * applied automatically:
     * - 30s for regular JSON requests
     * - 5 minutes for FormData uploads (Excel/CSV)
     */
    timeoutMs?: number;
    /**
     * H1: AbortSignal for request cancellation. When the signal fires,
     * the request is aborted and a DOMException with name 'AbortError'
     * is thrown (retried or converted to TimeoutError by the retry loop).
     */
    signal?: AbortSignal;
}

const buildUrlWithParams = (url: string, params?: Record<string, string | number | boolean | undefined | null>): string => {
    if (!params) return url;
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            searchParams.append(key, String(value));
        }
    });
    const queryString = searchParams.toString();
    return queryString ? `${url}?${queryString}` : url;
};

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

let isRefreshing = false;
interface QueueItem {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
}
let failedQueue: QueueItem[] = [];

const processQueue = (error: Error | null, token: string | null = null): void => {
    failedQueue.forEach(prom => {
        if (error) prom.reject(error);
        else prom.resolve(token);
    });
    failedQueue = [];
};

const isRetryableStatus = (status: number, attempt: number): boolean => {
    if (attempt === 0 && status >= 500) return false;
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
    return RETRYABLE_STATUS_CODES.includes(status);
};

const customFetch = async <T>(endpoint: string, options: RequestOptions & { method?: string; body?: unknown } = {}): Promise<T> => {
    const url = buildUrlWithParams(`${API_URL}${endpoint}`, options.params);
    const method = options.method || 'GET';
    const isFormData = options.body instanceof FormData;
    const headers = getHeaders(isFormData, method);
    const body = isFormData ? options.body : (options.body ? JSON.stringify(options.body) : undefined);
    const effectiveTimeout = options.timeoutMs ?? (isFormData ? UPLOAD_REQUEST_TIMEOUT : DEFAULT_REQUEST_TIMEOUT);

    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
        // H1: Merge external signal with timeout controller
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

        // If caller provides an external signal, abort our controller when it fires
        if (options.signal) {
            if (options.signal.aborted) {
                controller.abort();
            } else {
                options.signal.addEventListener('abort', () => controller.abort(), { once: true });
            }
        }

        try {
            const config: RequestInit = {
                method,
                headers,
                body,
                credentials: 'include',
                signal: controller.signal
            };

            const res = await fetch(url, config);
            clearTimeout(timeoutId);

            if (res.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
                if (isRefreshing) {
                    return new Promise((resolve, reject) => {
                        failedQueue.push({ resolve, reject });
                    }).then(() => customFetch<T>(endpoint, options)).catch((err) => { throw err; }) as Promise<T>;
                }

                isRefreshing = true;
                let refreshAttempts = 0;
                const maxRefreshAttempts = 2;
                
                while (refreshAttempts < maxRefreshAttempts) {
                    try {
                        const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include'
                        });

                        if (!refreshRes.ok) {
                            if (refreshRes.status === 401) {
                                refreshAttempts = maxRefreshAttempts;
                                break;
                            }
                            throw new Error('Refresh failed');
                        }

                        await refreshRes.json();
                        processQueue(null, null);
                        isRefreshing = false;
                        return customFetch<T>(endpoint, options);
                    } catch {
                        refreshAttempts++;
                        if (refreshAttempts >= maxRefreshAttempts) break;
                        await new Promise(r => setTimeout(r, 500));
                    }
                }

                isRefreshing = false;
                processQueue(new Error('Refresh failed'), null);
                const path = window.location.pathname;
                const isAuthPage = path.startsWith('/login') || path.startsWith('/request-reset') || path.startsWith('/reset-password');
                if (!isAuthPage) {
                    const redirectCount = parseInt(sessionStorage.getItem('loginRedirectCount') || '0');
                    if (redirectCount >= 3) {
                        sessionStorage.removeItem('loginRedirectCount');
                        throw new Error('Demasiados intentos de redirección. Por favor, recarga la página.');
                    }
                    sessionStorage.setItem('loginRedirectCount', String(redirectCount + 1));
                    window.location.href = '/login';
                }
                throw new Error('Session expired');
            }

            if (!res.ok) {
                if (attempt < MAX_RETRIES && isRetryableStatus(res.status, attempt)) {
                    attempt++;
                    const delay = RETRY_DELAYS[attempt - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }

                let errMsg = res.statusText;
                try {
                    const text = await res.text();
                    try {
                        const json = JSON.parse(text);
                        // Unified error shape: { success: false, message, errors? }
                        // Also handle legacy { status: "error", message, errors } from older endpoints
                        errMsg = json.message || text;
                        if (json.errors && Array.isArray(json.errors) && json.errors.length > 0) {
                            const first = json.errors[0];
                            if (first?.message) errMsg = `${errMsg}: ${first.message}`;
                        }
                    } catch { errMsg = text; }
                } catch {
                        // Ignore parse errors, use text value
                    }

                    if (res.status === 403) {
                    toast.error('⛔ Acceso denegado: No tienes permiso para esta acción.');
                }

                throw new ApiError(errMsg, res.status);
            }

            if (options.responseType === 'blob') {
                return res.blob() as Promise<T>;
            }
            return res.json();

        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error instanceof DOMException && error.name === 'AbortError') {
                if (attempt < MAX_RETRIES) {
                    attempt++;
                    const delay = RETRY_DELAYS[attempt - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
                throw new TimeoutError();
            }
            
            if (error instanceof TypeError && error.message.includes('fetch')) {
                if (attempt < MAX_RETRIES) {
                    attempt++;
                    const delay = RETRY_DELAYS[attempt - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
                throw new NetworkError('Network error occurred');
            }

            throw error;
        }
    }

    throw new Error('Max retries exceeded');
};

export const api = {
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