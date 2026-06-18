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

        // SECURITY: Auth is handled via the HttpOnly `access_token` cookie
        // automatically attached by the browser through `withCredentials`.
        // We do NOT read any token from localStorage / sessionStorage. The
        // server-side socket auth handler reads the cookie from the upgrade
        // request and validates the JWT.
        socketInstance = io(window.location.origin, {
            withCredentials: true,
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            pingTimeout: 60000,
            pingInterval: 25000,
        });

        setSocket(socketInstance);
        // Singleton socket - do not disconnect on unmount
        return () => {
            // Socket instance persists globally for shared lock state.
        };
    }, []);

    return { socket };
}
