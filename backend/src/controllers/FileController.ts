import { Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import type { AuthenticatedRequest } from '../types/express';
import { serveLocalUploadFile } from '../utils/fileDownload';

export const FileController = {
    getFile: async (req: Request, res: Response) => {
        const { filename } = req.params;
        const authReq = req as AuthenticatedRequest;

        // Authentication check
        if (!authReq.user) {
            throw new AppError('No estás autenticado.', 401);
        }

        // Validate filename chars - only allow alphanumeric, hyphens, underscores, periods.
        // Esta regex es una primera barrera de defense-in-depth sobre
        // `path.basename` (que ya neutraliza `..` y separadores).
        if (!filename || !/^[\w\-.]+$/.test(filename)) {
            throw new AppError('Nombre de archivo inválido', 400);
        }

        // MED-007/barrido: usamos el helper compartido que aplica
        // una segunda barrera de contención de path, sanitiza el
        // nombre de descarga y maneja errores de stream con
        // callback explícito (404 en ENOENT, 500 controlado en
        // otros casos).
        return serveLocalUploadFile(res, filename);
    }
};
