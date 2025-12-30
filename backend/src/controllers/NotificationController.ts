import { Request, Response } from 'express';
import { notificationService } from '../services/NotificationService';
import { v4 as uuidv4 } from 'uuid';

export const NotificationController = {
    stream: (req: Request, res: Response) => {
        // SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        // Send initial connection message
        res.write('data: {"status":"connected"}\n\n');

        const clientId = uuidv4();
        // Assuming auth middleware attaches user to req
        const userId = (req as any).user?.id;

        notificationService.addClient(clientId, res, userId);

        // Cleanup on close
        req.on('close', () => {
            notificationService.removeClient(clientId);
        });
    }
};
