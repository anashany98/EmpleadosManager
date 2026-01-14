import { prisma } from '../lib/prisma';

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
            }
        } catch (error) {
            console.error('Error notifying admins:', error);
        }
    }
};
