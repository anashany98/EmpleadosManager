import { Request, Response } from 'express';
import { DocumentTemplateService } from '../services/DocumentTemplateService';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';

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

    generate: async (req: Request, res: Response) => {
        const { employeeId, templateId, data } = req.body;

        if (!employeeId || !templateId) {
            throw new AppError('employeeId y templateId son obligatorios', 400);
        }

        try {
            let doc: any = null;

            if (templateId === 'epi') {
                const items = data?.items || [];
                doc = await DocumentTemplateService.generateEPI(employeeId, items);
            } else if (templateId === 'uniform') {
                const items = data?.items || [];
                doc = await DocumentTemplateService.generateUniform(employeeId, items);
            } else if (templateId === '145') {
                // returns Document object now
                const doc = await DocumentTemplateService.generateModel145(employeeId);
                return ApiResponse.success(res, {
                    message: 'Documento generado correctamente',
                    fileName: doc.name,
                    fileUrl: `/api/documents/${doc.id}/download`
                });
            } else if (templateId === 'tech_device') {
                const { deviceName, serialNumber } = data || {};
                // ...
                doc = await DocumentTemplateService.generateTechDevice(employeeId, deviceName, serialNumber);
            } else {
                throw new AppError('Plantilla no reconocida', 400);
            }

            // Return a download link for generated documents
            return ApiResponse.success(res, {
                message: 'Documento generado y archivado correctamente',
                fileName: doc?.name || 'Documento generado',
                fileUrl: doc?.id ? `/api/documents/${doc.id}/download` : undefined
            });
        } catch (error: any) {
            console.error('Error generating document:', error);
            throw new AppError(error.message || 'Error al generar el documento', 500);
        }
    }
};
