import { Request, Response } from 'express';
import { DocumentTemplateService } from '../services/DocumentTemplateService';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';

const log = createLogger('DocumentTemplateController');

export const DocumentTemplateController = {
    listTemplates: async (req: Request, res: Response) => {
        const templates = [
            { id: 'epi', name: 'Entrega de EPIs', category: 'PRL' },
            { id: 'uniform', name: 'Entrega de Uniforme', category: 'PRL' },
            { id: '145', name: 'Modelo 145 (IRPF)', category: 'Contrato' },
            { id: 'tech_device', name: 'Entrega Material Tecnológico', category: 'Equipo' }
        ];
        return ApiResponse.success(res, templates);
    },

    // Generic generate (optional, kept for backward compat if needed)
    generate: async (req: Request, res: Response) => {
        // ... implementation if needed, or deprecate
        return DocumentTemplateController.generateGeneric(req, res);
    },

    generateUniform: async (req: Request, res: Response) => {
        const { employeeId, items } = req.body;
        if (!employeeId) {
            throw new AppError('employeeId es obligatorio', 400);
        }
        const { user } = req as AuthenticatedRequest;
        const authorName = user?.name || 'Administrador';

        try {
            const doc = await DocumentTemplateService.generateUniform(employeeId, items || [], authorName);
            return ApiResponse.success(res, { message: 'Documento generado', fileName: doc.name, documentId: doc.id, fileUrl: doc?.id ? `/api/documents/${doc.id}/download` : undefined });
        } catch (error: any) { throw new AppError(error.message || 'Error al generar documento', 500); }
    },

    generateEPI: async (req: Request, res: Response) => {
        const { employeeId, items } = req.body;
        if (!employeeId) {
            throw new AppError('employeeId es obligatorio', 400);
        }
        const user = (req as any).user;
        const authorName = user?.name || 'Administrador';

        try {
            const doc = await DocumentTemplateService.generateEPI(employeeId, items || [], authorName);
            return ApiResponse.success(res, { message: 'Documento generado', fileName: doc.name, documentId: doc.id, fileUrl: doc?.id ? `/api/documents/${doc.id}/download` : undefined });
        } catch (error: any) { throw new AppError(error.message || 'Error al generar documento', 500); }
    },

    generateTech: async (req: Request, res: Response) => {
        const { employeeId, deviceName, serialNumber, itemId } = req.body;
        if (!employeeId) {
            throw new AppError('employeeId es obligatorio', 400);
        }
        const user = (req as any).user;
        const authorName = user?.name || 'Administrador';

        try {
            const doc = await DocumentTemplateService.generateTechDevice(employeeId, deviceName, serialNumber, authorName, itemId);
            return ApiResponse.success(res, { message: 'Documento generado', fileName: doc.name, documentId: doc.id, fileUrl: doc?.id ? `/api/documents/${doc.id}/download` : undefined });
        } catch (error: any) { throw new AppError(error.message || 'Error al generar documento', 500); }
    },

    generate145: async (req: Request, res: Response) => {
        const { employeeId } = req.body;
        if (!employeeId) {
            throw new AppError('employeeId es obligatorio', 400);
        }
        const user = (req as any).user;
        const authorName = user?.name || 'Administrador';

        try {
            const doc = await DocumentTemplateService.generateModel145(employeeId, authorName);
            return ApiResponse.success(res, { message: 'Documento generado', fileName: doc.name, documentId: doc.id, fileUrl: `/api/documents/${doc.id}/download` });
        } catch (error: any) { throw new AppError(error.message || 'Error al generar documento', 500); }
    },

    generateNDA: async (req: Request, res: Response) => {
        const { employeeId } = req.body;
        if (!employeeId) {
            throw new AppError('employeeId es obligatorio', 400);
        }
        const user = (req as any).user;
        const authorName = user?.name || 'Administrador';

        try {
            const doc = await DocumentTemplateService.generateNDA(employeeId, authorName);
            return ApiResponse.success(res, { message: 'Documento generado', fileName: doc.name, documentId: doc.id, fileUrl: doc?.id ? `/api/documents/${doc.id}/download` : undefined });
        } catch (error: any) { throw new AppError(error.message || 'Error al generar documento', 500); }
    },

    generateRGPD: async (req: Request, res: Response) => {
        const { employeeId } = req.body;
        if (!employeeId) {
            throw new AppError('employeeId es obligatorio', 400);
        }
        const user = (req as any).user;
        const authorName = user?.name || 'Administrador';

        try {
            const doc = await DocumentTemplateService.generateRGPD(employeeId, authorName);
            return ApiResponse.success(res, { message: 'Documento generado', fileName: doc.name, documentId: doc.id, fileUrl: doc?.id ? `/api/documents/${doc.id}/download` : undefined });
        } catch (error: any) { throw new AppError(error.message || 'Error al generar documento', 500); }
    },

    generateGeneric: async (req: Request, res: Response) => {
        // ... (previous generate logic for fallback)
        const { employeeId, templateId, data } = req.body;
        if (!employeeId) throw new AppError('employeeId es obligatorio', 400);

        const user = (req as any).user;
        const authorName = user?.name || 'Administrador';

        let doc: any = null;
        try {
            if (templateId === 'epi') {
                doc = await DocumentTemplateService.generateEPI(employeeId, data?.items || [], authorName);
            } else if (templateId === 'uniform') {
                doc = await DocumentTemplateService.generateUniform(employeeId, data?.items || [], authorName);
            } else if (templateId === '145') {
                doc = await DocumentTemplateService.generateModel145(employeeId, authorName);
                return ApiResponse.success(res, { message: 'Documento generado', fileName: doc.name, documentId: doc.id, fileUrl: `/api/documents/${doc.id}/download` });
            } else if (templateId === 'tech_device') {
                doc = await DocumentTemplateService.generateTechDevice(employeeId, data?.deviceName, data?.serialNumber, authorName, data?.itemId);
            } else if (templateId === 'nda') {
                doc = await DocumentTemplateService.generateNDA(employeeId, authorName);
            } else if (templateId === 'rgpd') {
                doc = await DocumentTemplateService.generateRGPD(employeeId, authorName);
            } else {
                throw new AppError('Plantilla no reconocida', 400);
            }
            return ApiResponse.success(res, { message: 'Documento generado', fileName: doc.name, documentId: doc.id, fileUrl: doc?.id ? `/api/documents/${doc.id}/download` : undefined });
        } catch (error: any) {
            log.error({ error }, 'Error generating document');
            throw new AppError(error.message || 'Error al generar documento', 500);
        }
    },

    sign: async (req: Request, res: Response) => {
        const { documentId, signatureDataUrl } = req.body;
        if (!documentId || !signatureDataUrl) throw new AppError('documentId y signatureDataUrl requeridos', 400);

        try {
            const document = await DocumentTemplateService.signDocument(documentId, signatureDataUrl);
            return ApiResponse.success(res, document, 'Documento firmado correctamente');
        } catch (error: any) {
            log.error({ error }, 'Error signing document');
            throw new AppError(error.message || 'Error al firmar documento', 500);
        }
    }
};
