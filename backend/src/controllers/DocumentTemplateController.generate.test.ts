import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Request, Response } from 'express';

vi.mock('../lib/prisma', () => ({
    prisma: {
        documentTemplate: {
            findUnique: vi.fn(),
            delete: vi.fn()
        },
        employee: {
            findUnique: vi.fn()
        },
        company: {
            findUnique: vi.fn(),
            update: vi.fn()
        }
    }
}));

vi.mock('../services/DocumentTemplateService', () => ({
    DocumentTemplateService: {
        generateUniform: vi.fn(),
        generateEPI: vi.fn(),
        generateMaterialDelivery: vi.fn(),
        generateTechDevice: vi.fn(),
        generateModel145: vi.fn(),
        generateNDA: vi.fn(),
        generateRGPD: vi.fn()
    }
}));

vi.mock('../services/documents/DocumentTemplateService', () => ({
    CompanyDocumentTemplateService: {
        getCatalog: vi.fn(),
        listTemplates: vi.fn(),
        getTemplate: vi.fn(),
        saveTemplate: vi.fn(),
        deleteTemplate: vi.fn(),
        buildContext: vi.fn(),
        renderTemplate: vi.fn(),
        generateDocumentFromTemplate: vi.fn()
    }
}));

vi.mock('../services/LoggerService', () => ({
    createLogger: () => ({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    })
}));

import { DocumentTemplateController } from './DocumentTemplateController';
import { CompanyDocumentTemplateService } from '../services/documents/DocumentTemplateService';
import { DocumentTemplateService } from '../services/DocumentTemplateService';
import { prisma } from '../lib/prisma';

const mockResponse = () => {
    const res: Partial<Response> = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
    };
    return res as Response;
};

describe('DocumentTemplateController.generateGeneric', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('generates canonical template types with the edited author name', async () => {
        vi.mocked(CompanyDocumentTemplateService.generateDocumentFromTemplate).mockResolvedValue({
            id: 'doc-1',
            name: 'Certificado Empresa',
            fileUrl: 'documents/doc-1.pdf'
        } as never);

        const req = {
            body: {
                employeeId: 'emp-1',
                templateType: 'CERTIFICADO_EMPRESA',
                authorName: 'Directora RRHH'
            },
            user: {
                id: 'user-1',
                name: 'Usuario actual',
                companyId: 'company-1'
            }
        } as unknown as Request;
        const res = mockResponse();

        await DocumentTemplateController.generateGeneric(req, res);

        expect(CompanyDocumentTemplateService.generateDocumentFromTemplate).toHaveBeenCalledWith({
            employeeId: 'emp-1',
            type: 'CERTIFICADO_EMPRESA',
            authorName: 'Directora RRHH',
            extraContext: undefined
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            data: expect.objectContaining({
                documentId: 'doc-1',
                fileUrl: '/documents/doc-1/download'
            })
        }));
    });

    it('normalizes legacy templateId values before generation', async () => {
        vi.mocked(CompanyDocumentTemplateService.generateDocumentFromTemplate).mockResolvedValue({
            id: 'doc-2',
            name: 'NDA'
        } as never);

        const req = {
            body: {
                employeeId: 'emp-1',
                templateId: 'nda'
            },
            user: {
                id: 'user-1',
                name: 'Usuario actual',
                companyId: 'company-1'
            }
        } as unknown as Request;
        const res = mockResponse();

        await DocumentTemplateController.generateGeneric(req, res);

        expect(CompanyDocumentTemplateService.generateDocumentFromTemplate).toHaveBeenCalledWith(expect.objectContaining({
            type: 'NDA',
            authorName: 'Usuario actual'
        }));
    });
});

describe('DocumentTemplateController.uploadLogo', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('persists the uploaded logo as the company-wide document logo', async () => {
        vi.mocked(prisma.company.findUnique).mockResolvedValue({ logoUrl: null } as never);
        vi.mocked(prisma.company.update).mockResolvedValue({ id: 'company-1' } as never);
        const req = {
            user: { id: 'user-1', companyId: 'company-1' },
            file: {
                filename: 'company-logo.png',
                path: 'C:\\missing-test-file\\company-logo.png'
            }
        } as unknown as Request;
        const res = mockResponse();

        await DocumentTemplateController.uploadLogo(req, res);

        expect(prisma.company.update).toHaveBeenCalledWith({
            where: { id: 'company-1' },
            data: { logoUrl: '/uploads/template-logos/company-logo.png' }
        });
        expect(res.status).toHaveBeenCalledWith(201);
    });
});

describe('DocumentTemplateController.listStoredTemplates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads the effective catalog for the employee when a global admin opens the generator', async () => {
        vi.mocked(prisma.employee.findUnique).mockResolvedValue({
            id: 'emp-1',
            companyId: 'company-employee'
        } as never);
        vi.mocked(CompanyDocumentTemplateService.listTemplates).mockResolvedValue([] as never);

        const req = {
            query: { employeeId: 'emp-1' },
            user: {
                id: 'admin-global',
                name: 'Admin global',
                role: 'admin',
                companyId: null
            }
        } as unknown as Request;
        const res = mockResponse();

        await DocumentTemplateController.listStoredTemplates(req, res);

        expect(CompanyDocumentTemplateService.listTemplates).toHaveBeenCalledWith({
            companyId: 'company-employee',
            includeGlobal: true
        });
        expect(res.status).toHaveBeenCalledWith(200);
    });
});

describe('DocumentTemplateController.generateMaterial', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('passes quantities and detail lines to the material delivery service', async () => {
        vi.mocked(DocumentTemplateService.generateMaterialDelivery).mockResolvedValue({
            id: 'doc-material-1',
            name: 'Entrega Material',
            fileUrl: 'documents/doc-material-1.pdf'
        } as never);

        const req = {
            body: {
                employeeId: 'emp-1',
                authorName: 'Responsable de almacen',
                items: [
                    { id: 'item-1', name: 'Cable HDMI', quantity: 3, detail: '2 metros' },
                    { id: 'item-2', name: 'Adaptador USB-C', quantity: 1, detail: '' }
                ]
            },
            user: {
                id: 'user-1',
                name: 'Usuario actual',
                companyId: 'company-1'
            }
        } as unknown as Request;
        const res = mockResponse();

        await DocumentTemplateController.generateMaterial(req, res);

        expect(DocumentTemplateService.generateMaterialDelivery).toHaveBeenCalledWith(
            'emp-1',
            [
                { id: 'item-1', name: 'Cable HDMI', quantity: 3, detail: '2 metros' },
                { id: 'item-2', name: 'Adaptador USB-C', quantity: 1, detail: '' }
            ],
            'Responsable de almacen'
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            data: expect.objectContaining({
                documentId: 'doc-material-1',
                fileUrl: '/documents/doc-material-1/download'
            })
        }));
    });
});
