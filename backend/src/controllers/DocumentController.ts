import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

export const DocumentController = {
    upload: async (req: Request, res: Response) => {
        const { employeeId, name, category, expiryDate } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No se ha subido ningún archivo' });
        }

        try {
            const document = await prisma.document.create({
                data: {
                    employeeId,
                    name: name || file.originalname,
                    category: category || 'OTHER',
                    fileUrl: `/uploads/documents/${file.filename}`,
                    expiryDate: expiryDate ? new Date(expiryDate) : null
                }
            });

            res.status(201).json(document);
        } catch (error) {
            console.error('Error al subir documento:', error);
            res.status(500).json({ error: 'Error al registrar el documento en la base de datos' });
        }
    },

    getByEmployee: async (req: Request, res: Response) => {
        const { employeeId } = req.params;
        try {
            const documents = await prisma.document.findMany({
                where: { employeeId },
                orderBy: { createdAt: 'desc' }
            });
            res.json(documents);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener documentos' });
        }
    },

    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const document = await prisma.document.findUnique({ where: { id } });
            if (!document) return res.status(404).json({ error: 'Documento no encontrado' });

            // Eliminar archivo físico
            const filePath = path.join(__dirname, '../../', document.fileUrl);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            await prisma.document.delete({ where: { id } });
            res.json({ message: 'Documento eliminado' });
        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar documento' });
        }
    }
};
