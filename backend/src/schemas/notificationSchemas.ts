import { z } from 'zod';

const idSchema = z.string().min(1);

export const notificationMarkReadSchema = z.object({
    params: z.object({
        id: idSchema
    })
});
