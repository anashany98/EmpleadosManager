import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';

import { createWorker } from 'tesseract.js';
import { StorageService } from '../services/StorageService';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';

const log = createLogger('DocumentController');



export const DocumentController = {
    // Procesar OCR para clasificar documentos
    processOCR: async (req: Request, res: Response) => {
        const file = req.file;
        if (!file) throw new AppError('No se ha subido ningún archivo', 400);

        try {
            const worker = await createWorker('spa');
            const { data: { text } } = await worker.recognize(file.buffer);
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
            log.error({ error }, 'Error OCR Documentos');
            throw new AppError('Error al procesar el documento mediante OCR', 500);
        }
    },

    upload: async (req: Request, res: Response) => {
        const { employeeId, name, category, expiryDate } = req.body;
        const file = req.file;

        if (!file) throw new AppError('No se ha subido ningún archivo', 400);
        if (!employeeId) throw new AppError('employeeId requerido', 400);

        try {
            const { user } = req as AuthenticatedRequest;
            if (user.role !== 'admin' && user.employeeId !== employeeId) {
                throw new AppError('No autorizado', 403);
            }
            const safeEmployeeId = employeeId.replace(/[^a-zA-Z0-9-]/g, '');
            if (safeEmployeeId !== employeeId) {
                throw new AppError('employeeId inválido', 400);
            }
            const subfolder = employeeId ? `EXP_${safeEmployeeId}` : 'general';
            const { key } = await StorageService.saveBuffer({
                folder: `documents/${subfolder}`,
                originalName: file.originalname,
                buffer: file.buffer,
                contentType: file.mimetype
            });
            const document = await prisma.document.create({
                data: {
                    employeeId,
                    name: name || file.originalname,
                    category: category || 'OTHER',
                    fileUrl: key,
                    expiryDate: expiryDate ? new Date(expiryDate) : null
                }
            });

            return ApiResponse.success(res, document, 'Documento subido correctamente', 201);
        } catch (error) {
            log.error({ error }, 'Error al subir documento');
            throw new AppError('Error al registrar el documento en la base de datos', 500);
        }
    },

    getByEmployee: async (req: Request, res: Response) => {
        const { employeeId } = req.params;
        try {
            const { user } = req as AuthenticatedRequest;
            if (user.role !== 'admin' && user.employeeId !== employeeId) {
                throw new AppError('No autorizado para ver estos documentos', 403);
            }

            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;
            const isPaginationRequested = req.query.page !== undefined;
            const skip = (page - 1) * limit;
            const take = isPaginationRequested ? limit : 500;

            const [total, documents] = await Promise.all([
                prisma.document.count({ where: { employeeId } }),
                prisma.document.findMany({
                    where: { employeeId },
                    orderBy: { createdAt: 'desc' },
                    skip: isPaginationRequested ? skip : undefined,
                    take
                })
            ]);

            if (isPaginationRequested) {
                return ApiResponse.success(res, {
                    data: documents,
                    meta: {
                        total,
                        page,
                        limit: take,
                        totalPages: Math.ceil(total / take)
                    }
                });
            }

            return ApiResponse.success(res, documents);
        } catch (error) {
            throw new AppError('Error al obtener documentos', 500);
        }
    },

    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const { user } = req as AuthenticatedRequest;
            const document = await prisma.document.findUnique({ where: { id } });
            if (!document) throw new AppError('Documento no encontrado', 404);
            if (user.role !== 'admin' && user.employeeId !== document.employeeId) {
                throw new AppError('No autorizado', 403);
            }

            // Eliminar archivo físico / S3
            if (document.fileUrl) {
                await StorageService.deleteFile(document.fileUrl);
            }

            await prisma.document.delete({ where: { id } });
            return ApiResponse.success(res, null, 'Documento eliminado');
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError('Error al eliminar documento', 500);
        }
    },

    download: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { user } = req as AuthenticatedRequest;
        const inline = req.query.inline === 'true';

        try {
            const document = await prisma.document.findUnique({
                where: { id },
                include: { employee: true }
            });

            if (!document) throw new AppError('Documento no encontrado', 404);

            // Security Check: Admin or Owner
            if (user.role !== 'admin' && user.employeeId !== document.employeeId) {
                throw new AppError('No tiene permisos para descargar este documento', 403);
            }

            if (StorageService.provider === 'local') {
                const fs = require('fs');
                const path = require('path');
                const filePath = path.join(process.cwd(), 'uploads', document.fileUrl);
                if (!fs.existsSync(filePath)) {
                    log.warn({ filePath }, 'File missing');
                    throw new AppError('El archivo físico no existe', 404);
                }

                if (inline) {
                    res.setHeader('Content-Type', 'application/pdf'); // Assumption: most are PDFs. 
                    // Better validation: use mime-types or store mimetype in DB. 
                    // For now, let express/sendfile handle it or default to PDF if we want to force preview.
                    // Actually res.sendFile does a good job guessing mime type from extension.
                    return res.sendFile(filePath);
                } else {
                    return res.download(filePath, document.name);
                }
            }

            const signedUrl = await StorageService.getSignedDownloadUrl(document.fileUrl);
            if (!signedUrl) throw new AppError('No se pudo generar URL de descarga', 500);
            return res.redirect(signedUrl);
        } catch (error) {
            if (error instanceof AppError) throw error;
            log.error({ error }, 'Download error');
            throw new AppError('Error al descargar el documento', 500);
        }
    }
};
