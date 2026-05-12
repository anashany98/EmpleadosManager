/**
 * Centralized logging utility
 * Only logs in development mode, silent in production
 */
const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) console.debug('[DEBUG]', ...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info('[INFO]', ...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn('[WARN]', ...args);
  },
  error: (...args: unknown[]) => {
    // Always log errors, but format better
    console.error('[ERROR]', ...args);
  },
};

/**
 * Log navigation/haptic feedback only in dev
 */
export const logNav = (action: string, ...data: unknown[]) => {
  if (isDev) console.log('[NAV]', action, ...data);
};

/**
 * Log API calls only in dev  
 */
export const logApi = (endpoint: string, ...data: unknown[]) => {
  if (isDev) console.log('[API]', endpoint, ...data);
};