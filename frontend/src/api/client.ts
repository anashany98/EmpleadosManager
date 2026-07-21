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
const RETRY_BASE_DELAYS = [1000, 2000, 4000];
const RETRY_JITTER_MAX_MS = 250;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
// HTTP methods that are safe to retry without explicit
// idempotency. POST and PATCH are NOT safe by default because
// retrying them can duplicate the side-effect (create two
// resources, double-charge, etc.). Callers must opt-in via
// `idempotent: true` or set an `Idempotency-Key` header.
const SAFE_TO_RETRY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);
// Cap for `Retry-After` (RFC 7231 allows the header to be
// arbitrary; 30s is a sane upper bound so a hostile or buggy
// server can't pin a client retrying for hours).
const MAX_RETRY_AFTER_MS = 30_000;

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
     * is thrown. The retry loop will NOT retry if this signal was the
     * one that aborted (caller explicitly cancelled).
     */
    signal?: AbortSignal;
    /**
     * MED-006: Mark an unsafe HTTP method (POST, PATCH) as safe to
     * retry. The caller is asserting that the endpoint is
     * idempotent (no duplicate side-effects on retry) OR has its
     * own idempotency mechanism. Without this flag, POST/PATCH
     * requests are NEVER retried, even on 5xx/429/408, because
     * re-trying a non-idempotent mutation can duplicate the
     * operation (e.g. create two payroll entries).
     *
     * If `idempotencyKey` is provided, the request is also
     * considered safe to retry and the key is forwarded as a
     * header.
     */
    idempotent?: boolean;
    idempotencyKey?: string;
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

const isRetryableStatus = (status: number): boolean => {
    return RETRYABLE_STATUS_CODES.has(status);
};

/**
 * Decide whether a failed request of `method` can be safely retried.
 *
 * - Safe methods (GET/HEAD/OPTIONS/PUT/DELETE) are always retried
 *   on retryable status codes.
 * - Unsafe methods (POST/PATCH) are only retried when the caller
 *   explicitly opts in via `idempotent: true` or by providing an
 *   `Idempotency-Key` header. Re-trying a non-idempotent POST
 *   can duplicate side effects (e.g. double-charge a customer,
 *   create two payroll entries).
 */
const isMethodSafeToRetry = (method: string, options: { idempotent?: boolean; idempotencyKey?: string }): boolean => {
    if (SAFE_TO_RETRY_METHODS.has(method.toUpperCase())) return true;
    if (options.idempotent === true) return true;
    if (typeof options.idempotencyKey === 'string' && options.idempotencyKey.length > 0) return true;
    return false;
};

/**
 * Compute the delay (ms) before the next retry attempt.
 *
 * - If `retryAfterMs` is set (server-supplied Retry-After), use it
 *   (clamped to MAX_RETRY_AFTER_MS).
 * - Otherwise use an exponential backoff based on the attempt
 *   number, with a small random jitter to prevent thundering herd.
 */
const computeBackoff = (attempt: number, retryAfterMs?: number): number => {
    if (retryAfterMs !== undefined) {
        return Math.max(0, Math.min(retryAfterMs, MAX_RETRY_AFTER_MS));
    }
    const base = RETRY_BASE_DELAYS[Math.min(attempt, RETRY_BASE_DELAYS.length - 1)];
    const jitter = Math.floor(Math.random() * RETRY_JITTER_MAX_MS);
    return base + jitter;
};

/**
 * Read the `Retry-After` header (RFC 7231 §7.1.3) and return the
 * delay in milliseconds, or `undefined` if the header is missing
 * or malformed. Supports both `delta-seconds` (numeric) and
 * `HTTP-date` formats; only the numeric form is honoured here
 * because HTTP-date handling requires a date library we don't
 * want to pull in for this corner case.
 */
const parseRetryAfter = (response: Response): number | undefined => {
    if (response.status !== 429) return undefined;
    const raw = response.headers.get('retry-after');
    if (!raw) return undefined;
    const seconds = Number.parseFloat(raw);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return seconds * 1000;
    }
    return undefined;
};

const customFetch = async <T>(endpoint: string, options: RequestOptions & { method?: string; body?: unknown } = {}): Promise<T> => {
    const url = buildUrlWithParams(`${API_URL}${endpoint}`, options.params);
    const method = options.method || 'GET';
    const isFormData = options.body instanceof FormData;
    const headers = getHeaders(isFormData, method);
    if (options.idempotencyKey) {
        headers['Idempotency-Key'] = options.idempotencyKey;
    }
    const body = isFormData ? options.body : (options.body ? JSON.stringify(options.body) : undefined);
    const effectiveTimeout = options.timeoutMs ?? (isFormData ? UPLOAD_REQUEST_TIMEOUT : DEFAULT_REQUEST_TIMEOUT);
    const methodRetryable = isMethodSafeToRetry(method, options);

    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
        // MED-006: combine the internal timeout signal with the
        // caller's external signal using `AbortSignal.any()`. This
        // avoids the manual `addEventListener` that previously
        // accumulated listeners per attempt (leak) and triggered
        // a re-retry on every AbortError regardless of who fired
        // it. `AbortSignal.any` is available in Node 20+ and
        // modern browsers (Chromium 116+, Firefox 124+, Safari
        // 17.4+).
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), effectiveTimeout);
        const combinedSignal = options.signal
            ? AbortSignal.any([timeoutController.signal, options.signal])
            : timeoutController.signal;

        try {
            const config: RequestInit = {
                method,
                headers,
                body,
                credentials: 'include',
                signal: combinedSignal
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
                // MED-006: previously the predicate short-circuited
                // 5xx on `attempt === 0`, so the first 5xx never
                // triggered a retry — exactly the opposite of what
                // the retry loop is for. Now we just check the
                // status code AND that the method is safe to retry.
                if (methodRetryable && attempt < MAX_RETRIES && isRetryableStatus(res.status)) {
                    attempt++;
                    const retryAfterMs = parseRetryAfter(res);
                    const delay = computeBackoff(attempt - 1, retryAfterMs);
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

            // MED-006: differentiate caller-initiated abort from
            // internal timeout abort. If the caller's signal was
            // the one that fired, do NOT retry — the user
            // explicitly cancelled, we must propagate that.
            if (error instanceof DOMException && error.name === 'AbortError') {
                if (options.signal?.aborted) {
                    throw error;
                }
                if (methodRetryable && attempt < MAX_RETRIES) {
                    attempt++;
                    const delay = computeBackoff(attempt - 1);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
                throw new TimeoutError();
            }

            if (error instanceof TypeError && error.message.includes('fetch')) {
                if (methodRetryable && attempt < MAX_RETRIES) {
                    attempt++;
                    const delay = computeBackoff(attempt - 1);
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