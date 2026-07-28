import { Request, Response } from 'express';
import { DocumentTemplateService } from '../services/DocumentTemplateService';
import { ApiResponse } from '../utils/ApiResponse';
import { handleControllerError } from '../utils/controllerError';
import { AppError } from '../utils/AppError';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';
import { prisma } from '../lib/prisma';
import { CompanyDocumentTemplateService } from '../services/documents/DocumentTemplateService';

const log = createLogger('DocumentTemplateController');

export const DocumentTemplateController = {
    listTemplates: async (req: Request, res: Response) => ApiResponse.success(res, CompanyDocumentTemplateService.getCatalog()),

    listStoredTemplates: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const templates = await CompanyDocumentTemplateService.listTemplates({
                companyId: user?.companyId || null,
                includeGlobal: true
            });

            return ApiResponse.success(res, templates);
        } catch (error) {
            log.error({ error }, 'Error listing stored templates');
            return ApiResponse.error(res, 'Error al listar plantillas guardadas', 500);
        }
    },

    getTemplate: async (req: Request, res: Response) => {
        try {
            const { type } = req.params;
            const { user } = req as AuthenticatedRequest;
            const template = await CompanyDocumentTemplateService.getTemplate(type, user?.companyId || null);

            if (!template) {
                return ApiResponse.error(res, 'Plantilla no encontrada', 404);
            }

            return ApiResponse.success(res, template);
        } catch (error) {
            log.error({ error }, 'Error getting template');
            return ApiResponse.error(res, 'Error al obtener plantilla', 500);
        }
    },

    saveTemplate: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { type, name, content, variables, isActive, isDefault, scope } = req.body;

            if (!type || !name || !content) {
                return ApiResponse.error(res, 'Faltan campos requeridos (type, name, content)', 400);
            }

            const isGlobalScope = scope === 'global';
            if (isGlobalScope && (user?.role !== 'admin' || user?.companyId)) {
                return ApiResponse.error(res, 'Solo un administrador global puede editar plantillas globales', 403);
            }

            const template = await CompanyDocumentTemplateService.saveTemplate({
                companyId: isGlobalScope ? null : (user?.companyId || null),
                type,
                name,
                content,
                variables: Array.isArray(variables) ? variables : [],
                isActive: isActive !== false,
                isDefault: Boolean(isDefault)
            });

            return ApiResponse.success(res, template, 'Plantilla guardada correctamente', 201);
        } catch (error) {
            log.error({ error }, 'Error saving template');
            return ApiResponse.error(res, 'Error al guardar plantilla', 500);
        }
    },

    deleteTemplate: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { user } = req as AuthenticatedRequest;
            const template = await prisma.documentTemplate.findUnique({ where: { id } });

            if (!template) {
                return ApiResponse.error(res, 'Plantilla no encontrada', 404);
            }

            const isGlobalTemplate = !template.companyId;
            if (isGlobalTemplate && (user?.role !== 'admin' || user?.companyId)) {
                return ApiResponse.error(res, 'Solo un administrador global puede eliminar plantillas globales', 403);
            }

            if (template.companyId && template.companyId !== user?.companyId && user?.role !== 'admin') {
                return ApiResponse.error(res, 'No autorizado para eliminar esta plantilla', 403);
            }

            await CompanyDocumentTemplateService.deleteTemplate(id);
            return ApiResponse.success(res, null, 'Plantilla eliminada correctamente');
        } catch (error) {
            log.error({ error }, 'Error deleting template');
            return ApiResponse.error(res, 'Error al eliminar plantilla', 500);
        }
    },

    previewTemplate: async (req: Request, res: Response) => {
        try {
            const { type, content, employeeId } = req.body;

            if (!content || !employeeId) {
                return ApiResponse.error(res, 'Faltan content o employeeId para la vista previa', 400);
            }

            const context = await CompanyDocumentTemplateService.buildContext(employeeId, {
                includePayroll: type === 'PAYROLL' || Boolean(req.body.includePayroll),
                includeVacations: Boolean(req.body.includeVacations) || type === 'NDA' || type === 'RGPD',
                authorName: req.body.authorName,
                extraContext: req.body.extraContext
            });

            const rendered = CompanyDocumentTemplateService.renderTemplate(content, context);
            return ApiResponse.success(res, { rendered, context });
        } catch (error) {
            log.error({ error }, 'Error previewing template');
            return ApiResponse.error(res, 'Error al generar la vista previa', 500);
        }
    },

    getAvailableVariables: async (req: Request, res: Response) => {
        try {
            const employeeId = String(req.query.employeeId || '');

            if (!employeeId) {
                return ApiResponse.error(res, 'Falta employeeId', 400);
            }

            const context = await CompanyDocumentTemplateService.buildContext(employeeId, {
                includePayroll: true,
                includeVacations: true
            });

            const walk = (value: unknown, prefix = ''): string[] => {
                if (!value || typeof value !== 'object' || Array.isArray(value)) {
                    return prefix ? [prefix] : [];
                }

                return Object.entries(value).flatMap(([key, nested]) => {
                    const nextPrefix = prefix ? `${prefix}.${key}` : key;
                    return walk(nested, nextPrefix);
                });
            };

            return ApiResponse.success(res, {
                variables: walk(context),
                catalog: CompanyDocumentTemplateService.getCatalog(),
                exampleContext: context
            });
        } catch (error) {
            log.error({ error }, 'Error getting template variables');
            return ApiResponse.error(res, 'Error al obtener variables disponibles', 500);
        }
    },

    // Generic generate (optional, kept for backward compat if needed)
    generate: async (req: Request, res: Response) => 
        // ... implementation if needed, or deprecate
         DocumentTemplateController.generateGeneric(req, res)
    ,

    generateUniform: async (req: Request, res: Response) => {
        const { employeeId, items } = req.body;
        if (!employeeId) {
            throw new AppError('employeeId es obligatorio', 400);
        }
        const { user } = req as AuthenticatedRequest;
        const authorName = req.body.authorName || user?.name || 'Administrador';

        try {
            const doc = await DocumentTemplateService.generateUniform(employeeId, items || [], authorName);
            return ApiResponse.success(res, { message: 'Documento generado', fileName: doc.name, documentId: doc.id, fileUrl: doc?.id ? `/documents/${doc.id}/download` : undefined });
        } catch (error: any) { throw new AppError(error.message || 'Error al generar documento', 500); }
    },

    generateEPI: async (req: Request, res: Response) => {
        const { employeeId, items } = req.body;
        if (!employeeId) {
            throw new AppError('employeeId es obligatorio', 400);
        }
        const user = (req as AuthenticatedRequest).user;
        const authorName = req.body.authorName || user?.name || 'Administrador';

        try {
            const doc = await DocumentTemplateService.generateEPI(employeeId, items || [], authorName);
            return ApiResponse.success(res, { message: 'Documento generado', fileName: doc.name, documentId: doc.id, fileUrl: doc?.id ? `/documents/${doc.id}/download` : undefined });
        } catch (error: unknown) { throw new AppError(error instanceof Error ? error.message : 'Error al generar documento', 500); }
    },

    generateMaterial: async (req: Request, res: Response) => {
        const { employeeId, items } = req.body;
        if (!employeeId) {
            throw new AppError('employeeId es obligatorio', 400);
        }
        const user = (req as AuthenticatedRequest).user;
        const authorName = req.body.authorName || user?.name || 'Administrador';

        try {
            const doc = await DocumentTemplateService.generateMaterialDelivery(employeeId, items || [], authorName);
            return ApiResponse.success(res, { message: 'Documento generado', fileName: doc.name, documentId: doc.id, fileUrl: doc?.id ? `/documents/${doc.id}/download` : undefined });
        } catch (error: unknown) { throw new AppError(error instanceof Error ? error.message : 'Error al generar documento', 500); }
    },

    generateTech: async (req: Request, res: Response) => {
        const { employeeId, deviceName, serialNumber, itemId } = req.body;
        if (!employeeId) {
            throw new AppError('employeeId es obligatorio', 400);
        }
        const user = (req as AuthenticatedRequest).user;
        const authorName = req.body.authorName || user?.name || 'Administrador';

        try {
            const doc = await DocumentTemplateService.generateTechDevice(employeeId, deviceName, serialNumber, authorName, itemId);
            return ApiResponse.success(res, { message: 'Documento generado', fileName: doc.name, documentId: doc.id, fileUrl: doc?.id ? `/documents/${doc.id}/download` : undefined });
        } catch (error: unknown) { throw new AppError(error instanceof Error ? error.message : 'Error al generar documento', 500); }
    },

    generate145: async (req: Request, res: Response) => {
        const { employeeId } = req.body;
        if (!employeeId) {
            throw new AppError('employeeId es obligatorio', 400);
        }
        const user = (req as AuthenticatedRequest).user;
        const authorName = req.body.authorName || user?.name || 'Administrador';

        try {
            const doc = await DocumentTemplateService.generateModel145(employeeId, authorName);
            return ApiResponse.success(res, { message: 'Documento generado', fileName: doc.name, documentId: doc.id, fileUrl: `/documents/${doc.id}/download` });
        } catch (error: unknown) { throw new AppError(error instanceof Error ? error.message : 'Error al generar documento', 500); }
    },

    generateNDA: async (req: Request, res: Response) => {
        const { employeeId } = req.body;
        if (!employeeId) {
            throw new AppError('employeeId es obligatorio', 400);
        }
        const user = (req as AuthenticatedRequest).user;
        const authorName = req.body.authorName || user?.name || 'Administrador';

        try {
            const doc = await DocumentTemplateService.generateNDA(employeeId, authorName);
            return ApiResponse.success(res, { message: 'Documento generado', fileName: doc.name, documentId: doc.id, fileUrl: doc?.id ? `/documents/${doc.id}/download` : undefined });
        } catch (error: unknown) { throw new AppError(error instanceof Error ? error.message : 'Error al generar documento', 500); }
    },

    generateRGPD: async (req: Request, res: Response) => {
        const { employeeId } = req.body;
        if (!employeeId) {
            throw new AppError('employeeId es obligatorio', 400);
        }
        const user = (req as AuthenticatedRequest).user;
        const authorName = req.body.authorName || user?.name || 'Administrador';

        try {
            const doc = await DocumentTemplateService.generateRGPD(employeeId, authorName);
            return ApiResponse.success(res, { message: 'Documento generado', fileName: doc.name, documentId: doc.id, fileUrl: doc?.id ? `/documents/${doc.id}/download` : undefined });
        } catch (error: unknown) { throw new AppError(error instanceof Error ? error.message : 'Error al generar documento', 500); }
    },

    generateGeneric: async (req: Request, res: Response) => {
        const { employeeId, templateId, templateType, type, data, extraContext } = req.body;
        if (!employeeId) throw new AppError('employeeId es obligatorio', 400);

        const user = (req as AuthenticatedRequest).user;
        const authorName = req.body.authorName || user?.name || 'Administrador';
        const requestedType = templateType || type || templateId;

        if (!requestedType) {
            throw new AppError('templateType es obligatorio', 400);
        }

        const legacyAliases: Record<string, string> = {
            epi: 'EPI',
            uniform: 'UNIFORM',
            '145': 'MODEL_145',
            tech_device: 'TECH_DEVICE',
            nda: 'NDA',
            rgpd: 'RGPD'
        };
        const normalizedType = legacyAliases[String(requestedType).toLowerCase()] || String(requestedType);

        try {
            if (normalizedType === 'MODEL_145') {
                const doc = await DocumentTemplateService.generateModel145(employeeId, authorName);
                return ApiResponse.success(res, { message: 'Documento generado', fileName: doc.name, documentId: doc.id, fileUrl: `/documents/${doc.id}/download` });
            }

            const doc = await CompanyDocumentTemplateService.generateDocumentFromTemplate({
                employeeId,
                type: normalizedType,
                companyId: user?.companyId || null,
                authorName,
                extraContext: extraContext || data
            });
            return ApiResponse.success(res, { message: 'Documento generado', fileName: doc.name, documentId: doc.id, fileUrl: doc?.id ? `/documents/${doc.id}/download` : undefined });
        } catch (error: unknown) {
            log.error({ error }, 'Error generating document');
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError(error instanceof Error ? error.message : 'Error al generar documento', 500);
        }
    },

    sign: async (req: Request, res: Response) => {
        const { documentId, signatureDataUrl } = req.body;
        const user = (req as AuthenticatedRequest).user;

        if (!documentId || !signatureDataUrl) {
            throw new AppError('documentId y signatureDataUrl requeridos', 400);
        }

        try {
            // CRIT-004: pasamos el actor para que el servicio valide
            // tenant y autorización. La ruta /sign YA está protegida
            // por `authorize('document.write', resolveSignTarget)`, así
            // que aquí ya sabemos que el usuario puede actuar sobre el
            // doc. Pero el servicio mantiene su propia verificación
            // (defense in depth) por si se llama desde otros puntos.
            const document = await DocumentTemplateService.signDocument(documentId, signatureDataUrl, user);
            return ApiResponse.success(res, document, 'Documento firmado correctamente');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Error al firmar documento';
            // 404 uniforme para no enumerar IDs ajenos
            const status = /no encontrad|otro tenant|sin empresa|forbidden|not found|traversal|clave|png|formato|tamañ/i.test(message) ? 404 : 500;
            log.error({ error, status }, 'Error signing document');
            throw new AppError(message, status);
        }
    },

    uploadLogo: async (req: Request, res: Response) => {
        try {
            const { user } = req as AuthenticatedRequest;
            if (!user?.companyId) {
                return ApiResponse.error(res, 'No tienes una empresa asignada', 400);
            }

            if (!req.file) {
                return ApiResponse.error(res, 'No se ha subido ningún archivo', 400);
            }

            const logoUrl = `/uploads/template-logos/${req.file.filename}`;
            return ApiResponse.success(res, { logoUrl, fileName: req.file.filename }, 'Logo subido correctamente', 201);
        } catch (error: unknown) {
            log.error({ error }, 'Error uploading logo');
            return handleControllerError(res, error, 'Error al subir el logo');
        }
    }
};
