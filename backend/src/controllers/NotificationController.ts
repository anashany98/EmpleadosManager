
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { NotificationStream } from '../services/NotificationStream';

export const createNotification = async (userId: string, title: string, message: string, type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'INFO', link?: string) => {
    try {
        await prisma.notification.create({
            data: { userId, title, message, type, link }
        });
    } catch (error) {
        console.error('Error creating notification:', error);
    }
};

export const NotificationController = {
    stream: async (req: Request, res: Response) => {
        const user = (req as any).user;

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders?.();

        // Send initial ping
        res.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);

        NotificationStream.addClient(user.id, res);

        const heartbeat = setInterval(() => {
            res.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
        }, 25000);

        req.on('close', () => {
            clearInterval(heartbeat);
            NotificationStream.removeClient(user.id, res);
        });
    },
    getMine: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            const notifications = await prisma.notification.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: 'desc' },
                take: 50
            });

            // Count unread
            const unreadCount = await prisma.notification.count({
                where: { userId: user.id, read: false }
            });

            return ApiResponse.success(res, { notifications, unreadCount });
        } catch (error) {
            console.error(error);
            return ApiResponse.error(res, 'Error al obtener notificaciones', 500);
        }
    },

    markRead: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            const { id } = req.params;

            await prisma.notification.updateMany({
                where: { id, userId: user.id }, // Security: ensure it belongs to user
                data: { read: true }
            });

            return ApiResponse.success(res, { success: true });
        } catch (error) {
            return ApiResponse.error(res, 'Error al marcar como leída', 500);
        }
    },

    markAllRead: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            await prisma.notification.updateMany({
                where: { userId: user.id, read: false },
                data: { read: true }
            });
            return ApiResponse.success(res, { success: true });
        } catch (error) {
            return ApiResponse.error(res, 'Error al marcar todas como leídas', 500);
        }
    }
};
