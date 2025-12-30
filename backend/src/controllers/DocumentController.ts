import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import path from 'path';
import fs from 'fs';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';

import { createWorker } from 'tesseract.js';



export const DocumentController = {
    // Procesar OCR para clasificar documentos
    processOCR: async (req: Request, res: Response) => {
        const file = req.file;
        if (!file) throw new AppError('No se ha subido ningún archivo', 400);

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

            return ApiResponse.success(res, {
                text: text.substring(0, 500),
                suggestedCategory,
                suggestedDate
            }, 'OCR completado');
        } catch (error) {
            console.error('Error OCR Documentos:', error);
            throw new AppError('Error al procesar el documento mediante OCR', 500);
        }
    },

    upload: async (req: Request, res: Response) => {
        const { employeeId, name, category, expiryDate } = req.body;
        const file = req.file;

        if (!file) throw new AppError('No se ha subido ningún archivo', 400);

        try {
            const subfolder = employeeId ? `EXP_${employeeId}/` : '';
            const document = await prisma.document.create({
                data: {
                    employeeId,
                    name: name || file.originalname,
                    category: category || 'OTHER',
                    fileUrl: `/uploads/documents/${subfolder}${file.filename}`,
                    expiryDate: expiryDate ? new Date(expiryDate) : null
                }
            });

            return ApiResponse.success(res, document, 'Documento subido correctamente', 201);
        } catch (error) {
            console.error('Error al subir documento:', error);
            throw new AppError('Error al registrar el documento en la base de datos', 500);
        }
    },

    getByEmployee: async (req: Request, res: Response) => {
        const { employeeId } = req.params;
        try {
            const documents = await prisma.document.findMany({
                where: { employeeId },
                orderBy: { createdAt: 'desc' }
            });
            return ApiResponse.success(res, documents);
        } catch (error) {
            throw new AppError('Error al obtener documentos', 500);
        }
    },

    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const document = await prisma.document.findUnique({ where: { id } });
            if (!document) throw new AppError('Documento no encontrado', 404);

            // Eliminar archivo físico
            const filePath = path.join(process.cwd(), document.fileUrl);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            await prisma.document.delete({ where: { id } });
            return ApiResponse.success(res, null, 'Documento eliminado');
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError('Error al eliminar documento', 500);
        }
    }
};
