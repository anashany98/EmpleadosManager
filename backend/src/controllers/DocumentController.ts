import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { validateUpload } from '../config/multer';
import { AuthenticatedRequest } from '../types/express';
import { scanFileSecurity, scanWithClamAV } from '../utils/fileSecurity';

import { createWorker, Worker } from 'tesseract.js';
import { StorageService } from '../services/StorageService';
import { createLogger } from '../services/LoggerService';

const log = createLogger('DocumentController');

// Singleton OCR worker to prevent memory leaks
let ocrWorker: Worker | null = null;
let ocrWorkerLock = false;

async function getOcrWorker(): Promise<Worker> {
    if (ocrWorker) {
        return ocrWorker;
    }
    
    // Prevent multiple concurrent worker creation
    if (ocrWorkerLock) {
        // Wait a bit and retry
        await new Promise(r => setTimeout(r, 100));
        if (ocrWorker) return ocrWorker;
    }
    
    ocrWorkerLock = true;
    try {
        ocrWorker = await createWorker('spa');
        log.info('OCR worker initialized');
        return ocrWorker;
    } finally {
        ocrWorkerLock = false;
    }
}

async function assertEmployeeExists(employeeId: string): Promise<void> {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true }
    });

    if (!employee) {
        throw new AppError('Empleado no encontrado', 404);
    }
}

export const DocumentController = {
    // Procesar OCR para clasificar documentos
    processOCR: async (req: Request, res: Response) => {
        const file = req.file;
        if (!file) throw new AppError('No se ha subido ningún archivo', 400);

        // Validate file size for OCR (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            throw new AppError('Archivo demasiado grande para OCR (máximo 10MB)', 400);
        }
        
        // Security scan before OCR processing
        const securityResult = await scanFileSecurity(file.buffer, file.originalname, file.mimetype);
        if (!securityResult.safe) {
            log.error({ filename: file.originalname, issues: securityResult.issues }, 'File security scan failed in OCR');
            throw new AppError(`Archivo rechazado por seguridad: ${securityResult.issues.join(', ')}`, 400);
        }

        try {
            validateUpload(file);
            const worker = await getOcrWorker();
            const { data: { text } } = await worker.recognize(file.buffer);

            const cleanText = text.replace(/\s+/g, ' ').toLowerCase();

            // 1. Clasificación automática por palabras clave
            let suggestedCategory = 'OTHER';
            if (cleanText.includes('nómina') || cleanText.includes('recibo de salarios') || cleanText.includes('liq.gananciales')) suggestedCategory = 'PAYROLL';
            else if (cleanText.includes('contrato') || cleanText.includes('empleador') || cleanText.includes('cláusula')) suggestedCategory = 'CONTRACT';
            else if (cleanText.includes('dni') || cleanText.includes('nie') || cleanText.includes('identidad')) suggestedCategory = 'DNI';
            else if (cleanText.includes('médico') || cleanText.includes('salud') || cleanText.includes('sanitaria')) suggestedCategory = 'MEDICAL';
            else if (cleanText.includes('curso') || cleanText.includes('formación') || cleanText.includes('diploma')) suggestedCategory = 'TRAINING';

            // 2. Extracción de fecha (DNI caducidad, fecha de contrato, etc.)
            const dateRegex = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})/;
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
        const { user } = req as AuthenticatedRequest;

        if (!file) throw new AppError('No se ha subido ningún archivo', 400);
        if (!employeeId) throw new AppError('employeeId requerido', 400);

        validateUpload(file);

        let savedKey: string | null = null;

        try {
            // Verify employee exists AND user has access (company scoping)
            const employee = await prisma.employee.findUnique({
                where: { id: employeeId },
                select: { id: true, companyId: true }
            });
            
            if (!employee) {
                throw new AppError('Empleado no encontrado', 404);
            }
            
            // Company access check
            if (user?.companyId && employee.companyId !== user.companyId) {
                throw new AppError('No tienes permiso para subir documentos a este empleado', 403);
            }
            
            // Security scan: Magic bytes + malicious signatures + suspicious content
            const securityResult = await scanFileSecurity(file.buffer, file.originalname, file.mimetype);
            if (!securityResult.safe) {
                log.error({ filename: file.originalname, issues: securityResult.issues }, 'File security scan failed');
                throw new AppError(`Archivo rechazado por seguridad: ${securityResult.issues.join(', ')}`, 400);
            }
            
            // ClamAV virus scan (if configured)
            const virusResult = await scanWithClamAV(file.buffer);
            if (!virusResult.clean) {
                log.error({ filename: file.originalname, virus: virusResult.virus }, 'Virus detected');
                throw new AppError(`Virus detectado: ${virusResult.virus}`, 400);
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
            savedKey = key;

            const document = await prisma.$transaction(async (tx) => await tx.document.create({
                    data: {
                        employeeId,
                        name: name || file.originalname,
                        category: category || 'OTHER',
                        fileUrl: key,
                        expiryDate: expiryDate ? new Date(expiryDate) : null
                    }
                }));

            return ApiResponse.success(res, document, 'Documento subido correctamente', 201);
        } catch (error) {
            log.error({ error, savedKey }, 'Error al subir documento - archivo可能会保留');
            if (error instanceof AppError) throw error;
            throw new AppError('Error al registrar el documento en la base de datos', 500);
        }
    },

    getByEmployee: async (req: Request, res: Response) => {
        const { employeeId } = req.params;
        try {
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
            if (error instanceof AppError) throw error;
            throw new AppError('Error al obtener documentos', 500);
        }
    },

    delete: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { user } = req as AuthenticatedRequest;
        try {
            const document = await prisma.document.findUnique({
                where: { id },
                include: { employee: { select: { companyId: true } } }
            });
            if (!document) throw new AppError('Documento no encontrado', 404);

            // SECURITY: enforce company scoping on delete (same as download).
            const isGlobalAdmin = user?.role === 'admin' && !user.companyId;
            if (!isGlobalAdmin && user?.companyId && document.employee?.companyId !== user.companyId) {
                throw new AppError('No tienes permiso para eliminar este documento', 403);
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
        const inline = req.query.inline === 'true';
        const { user } = req as AuthenticatedRequest;

        try {
            const document = await prisma.document.findUnique({
                where: { id },
                include: { employee: { select: { companyId: true, deletedAt: true } } }
            });

            if (!document) throw new AppError('Documento no encontrado', 404);

            // ────────────────────────────────────────────────────────────────────
            // SECURITY FIX 2026-06-18 — IDOR prevention (cross-tenant document
            // download). The previous version only checked `document.read`
            // permission via the `authorize` middleware, which does NOT verify
            // that the authenticated user's company matches the document's
            // employee's company. A user with valid `document.read` permission
            // in company-A could download any document of company-B by
            // guessing or enumerating document IDs.
            //
            // Multi-tenant rules:
            //   - Global admin (role=admin, no companyId): full access.
            //   - Company-scoped user: must match document's employee.companyId.
            //   - Soft-deleted employee: refuse download (GDPR Art. 17 — once
            //     retention period elapses and purge runs, files are gone;
            //     until then only admins with explicit reason may access).
            // ────────────────────────────────────────────────────────────────────
            const isGlobalAdmin = user?.role === 'admin' && !user.companyId;
            if (!isGlobalAdmin) {
                if (user?.companyId && document.employee?.companyId !== user.companyId) {
                    log.warn({
                        userId: user?.id,
                        userCompany: user?.companyId,
                        documentCompany: document.employee?.companyId,
                        documentId: id
                    }, 'Cross-tenant document download attempt blocked');
                    throw new AppError('No tienes permiso para acceder a este documento', 403);
                }
            }

            if (StorageService.provider === 'local') {
                const fs = await import('fs');
                const path = await import('path');
                const filePath = path.join(process.cwd(), 'uploads', document.fileUrl);
                if (!fs.existsSync(filePath)) {
                    log.warn({ filePath }, 'File missing');
                    throw new AppError('El archivo físico no existe', 404);
                }

                if (inline) {
                    // Try to detect primitive types, else default.
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
