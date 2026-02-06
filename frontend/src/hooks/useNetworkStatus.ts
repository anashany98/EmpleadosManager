import { useEffect, useState, useCallback } from 'react';

export function useNetworkStatus() {
    const [isOnline, setIsOnline] = useState(() => navigator.onLine);

    const checkConnection = useCallback(async () => {
        if (!navigator.onLine) {
            setIsOnline(false);
            return;
        }

        try {
            // Try to reach the health check endpoint
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            // Use 'api/health' assuming it exists as seen in index.ts
            // Using HEAD to minimize data transfer
            const res = await fetch('/api/health', {
                method: 'HEAD',
                cache: 'no-store',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // If we get a response (even 404 or 500), we are "online" in terms of network
            setIsOnline(true);
        } catch (error) {
            // Fetch failed (network error, timeout)
            setIsOnline(false);
        }
    }, []);

    useEffect(() => {
        const handleOnline = () => checkConnection();
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Periodic check to detect "phantom" execution connection
        // Every 30 seconds
        const intervalId = setInterval(checkConnection, 30000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(intervalId);
        };
    }, [checkConnection]);

    return isOnline;
}
