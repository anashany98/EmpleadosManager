import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AppError } from '../utils/AppError';
import type { AuthenticatedRequest } from '../types/express';

export const FileController = {
    getFile: async (req: Request, res: Response) => {
        const { filename } = req.params;
        const authReq = req as AuthenticatedRequest;

        // Authentication check
        if (!authReq.user) {
            throw new AppError('No estás autenticado.', 401);
        }

        // Validate filename chars - only allow alphanumeric, hyphens, underscores, periods
        if (!filename || !/^[\w\-.]+$/.test(filename)) {
            throw new AppError('Nombre de archivo inválido', 400);
        }

        // Prevent directory traversal with resolve + containment check
        const uploadDir = path.resolve(process.cwd(), 'uploads');
        const filePath = path.resolve(uploadDir, filename);

        // Ensure resolved path is still inside uploadDir
        if (!filePath.startsWith(uploadDir + path.sep)) {
            throw new AppError('Nombre de archivo inválido', 400);
        }

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            throw new AppError('Archivo no encontrado', 404);
        }

        // Send file
        res.sendFile(filePath);
    }
};
