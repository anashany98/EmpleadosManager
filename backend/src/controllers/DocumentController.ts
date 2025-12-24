import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

import { createWorker } from 'tesseract.js';

const prisma = new PrismaClient();

export const DocumentController = {
    // Procesar OCR para clasificar documentos
    processOCR: async (req: Request, res: Response) => {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No se ha subido ningún archivo' });

        try {
            const worker = await createWorker('spa');
            const { data: { text } } = await worker.recognize(file.path);
            await worker.terminate();

            const cleanText = text.replace(/\s+/g, ' ').toLowerCase();

            // 1. Clasificación automática por palabras clave
            let suggestedCategory = 'OTHER';
            if (cleanText.includes('nómina') || cleanText.includes('recibo de salarios') || cleanText.includes('liq.gananciales')) suggestedCategory = 'PAYROLL';
            else if (cleanText.includes('contrato') || cleanText.includes('empleador') || cleanText.includes('cláusula')) suggestedCategory = 'CONTRACT';
            else if (cleanText.includes('dni') || cleanText.includes('nie') || cleanText.includes('identidad')) suggestedCategory = 'DNI';
            else if (cleanText.includes('médico') || cleanText.includes('salud') || cleanText.includes('sanitaria')) suggestedCategory = 'MEDICAL';
            else if (cleanText.includes('curso') || cleanText.includes('formación') || cleanText.includes('diploma')) suggestedCategory = 'TRAINING';

            // 2. Extracción de fecha (DNI caducidad, fecha de contrato, etc.)
            const dateRegex = /(\d{1,2})[\/\-\. ](\d{1,2})[\/\-\. ](\d{4}|\d{2})/;
            const dateMatch = cleanText.match(dateRegex);
            let suggestedDate = null;
            if (dateMatch) {
                const day = parseInt(dateMatch[1]);
                const month = parseInt(dateMatch[2]);
                let year = parseInt(dateMatch[3]);
                if (year < 100) year += 2000;
                if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                    suggestedDate = new Date(year, month - 1, day).toISOString().split('T')[0];
                }
            }

            res.json({
                text: text.substring(0, 500),
                suggestedCategory,
                suggestedDate
            });
        } catch (error) {
            console.error('Error OCR Documentos:', error);
            res.status(500).json({ error: 'Error al procesar el documento' });
        }
    },

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
