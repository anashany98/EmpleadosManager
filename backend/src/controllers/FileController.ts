import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AppError } from '../utils/AppError';

export const FileController = {
    getFile: async (req: Request, res: Response) => {
        const { filename } = req.params;

        // Basic validation to prevent directory traversal
        if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            throw new AppError('Nombre de archivo inválido', 400);
        }

        const uploadDir = path.join(process.cwd(), 'uploads');
        const filePath = path.join(uploadDir, filename);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            throw new AppError('Archivo no encontrado', 404);
        }

        // Send file
        res.sendFile(filePath);
    }
};
