import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export function useSocket() {
    const [socket, setSocket] = useState<Socket | null>(() => socketInstance);

    useEffect(() => {
        if (socketInstance) {
            setSocket(socketInstance);
            return;
        }

        const legacyToken = import.meta.env.DEV
            ? sessionStorage.getItem('token') || localStorage.getItem('token')
            : undefined;

        socketInstance = io(window.location.origin, {
            auth: legacyToken ? { token: legacyToken } : undefined,
            withCredentials: true,
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        setSocket(socketInstance);
        // Singleton socket - do not disconnect on unmount
        // Production auth uses the HttpOnly access_token cookie via withCredentials.
        return () => {
            // Socket instance persists globally for shared lock state.
        };
    }, []);

    return { socket };
}
