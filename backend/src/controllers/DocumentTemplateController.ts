import { Request, Response } from 'express';
import { DocumentTemplateService } from '../services/DocumentTemplateService';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';
import path from 'path';

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
            let filePath = '';

            if (templateId === 'epi') {
                const items = data?.items || [];
                filePath = await DocumentTemplateService.generateEPI(employeeId, items);
            } else if (templateId === 'uniform') {
                const items = data?.items || [];
                filePath = await DocumentTemplateService.generateUniform(employeeId, items);
            } else if (templateId === '145') {
                filePath = await DocumentTemplateService.generateModel145(employeeId);
            } else if (templateId === 'tech_device') {
                const { deviceName, serialNumber } = data || {};
                if (!deviceName || !serialNumber) {
                    throw new AppError('Nombre del dispositivo y número de serie son obligatorios', 400);
                }
                filePath = await DocumentTemplateService.generateTechDevice(employeeId, deviceName, serialNumber);
            } else {
                throw new AppError('Plantilla no reconocida', 400);
            }

            return ApiResponse.success(res, {
                message: 'Documento generado y archivado correctamente',
                fileName: path.basename(filePath)
            });
        } catch (error: any) {
            console.error('Error generating document:', error);
            throw new AppError(error.message || 'Error al generar el documento', 500);
        }
    }
};
