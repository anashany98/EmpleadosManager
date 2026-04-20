import { Request, Response, NextFunction } from 'express';
import { AnyZodObject } from 'zod';

export const validateResource = (schema: AnyZodObject) => async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result: any = await schema.parseAsync({
            body: req.body,
            query: req.query,
            params: req.params,
        });

        if ('body' in result) req.body = result.body;
        if ('query' in result) req.query = result.query;
        if ('params' in result) req.params = result.params;

        next();
    } catch (e: any) {
        return res.status(400).json({
            status: 'error',
            message: 'Error de validación',
            errors: e.errors
        });
    }
};
