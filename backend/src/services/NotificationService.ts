import { prisma } from '../lib/prisma';
import { NotificationStream } from './NotificationStream';

export const NotificationService = {
    create: async ({ userId, title, message, type = 'INFO', link }: {
        userId: string,
        title: string,
        message: string,
        type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR',
        link?: string
    }) => {
        try {
            await prisma.notification.create({
                data: {
                    userId,
                    title,
                    message,
                    type,
                    link
                }
            });
            NotificationStream.sendToUser(userId, 'NOTIFICATION', { title, message, type, link });
        } catch (error) {
            console.error('Error creating notification:', error);
        }
    },

    notifyAdmins: async (title: string, message: string, link?: string) => {
        try {
            const admins = await prisma.user.findMany({
                where: { role: 'admin' }
            });

            for (const admin of admins) {
                await prisma.notification.create({
                    data: {
                        userId: admin.id,
                        title,
                        message,
                        type: 'INFO',
                        link
                    }
                });
                NotificationStream.sendToUser(admin.id, 'INBOX_NEW_DOCUMENT', { title, message, link });
            }
        } catch (error) {
            console.error('Error notifying admins:', error);
        }
    }
};
