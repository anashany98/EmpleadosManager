import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/prisma', () => ({
    prisma: {
        employee: {
            findUnique: vi.fn()
        },
        document: {
            create: vi.fn()
        },
        documentTemplate: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
            updateMany: vi.fn(),
            update: vi.fn(),
            create: vi.fn(),
            delete: vi.fn()
        }
    }
}));

vi.mock('../StorageService', () => ({
    StorageService: {
        saveBuffer: vi.fn(),
        deleteFile: vi.fn()
    }
}));

vi.mock('../EncryptionService', () => ({
    EncryptionService: {
        decrypt: vi.fn((value: string) => value)
    }
}));

vi.mock('../VacationBalanceService', () => ({
    getEmployeeVacationBalanceSummary: vi.fn()
}));

vi.mock('./DocumentPdfUtils', () => ({
    addQRCodeToPDF: vi.fn(),
    buildPdfBuffer: vi.fn(),
    getLogoPath: vi.fn(),
    writeTemplateText: vi.fn()
}));

vi.mock('./DocumentLayoutService', () => ({
    parseLayoutTemplate: vi.fn(),
    renderLayoutTemplate: vi.fn()
}));

vi.mock('../../services/LoggerService', () => ({
    createLogger: () => ({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    })
}));

import { prisma } from '../../lib/prisma';
import { StorageService } from '../StorageService';
import { CompanyDocumentTemplateService, type ResolvedTemplate, type TemplateContext } from './DocumentTemplateService';

describe('CompanyDocumentTemplateService.generateDocumentFromTemplate', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it('provides a complete visual layout for every editable built-in template', () => {
        const catalog = CompanyDocumentTemplateService.getCatalog();

        expect(catalog.length).toBeGreaterThan(0);
        catalog.forEach((template) => {
            const parsed = JSON.parse(template.content);
            expect(parsed, template.type).toMatchObject({
                kind: 'layout-template',
                version: 1
            });
            expect(parsed.elements.length, template.type).toBeGreaterThan(8);
            expect(
                parsed.elements.some((element: { type?: string; dataSource?: string }) =>
                    element.type === 'qr' && element.dataSource === 'document'
                ),
                template.type
            ).toBe(true);
        });
    });

    it('migrates the old LOGO placeholder without overwriting custom template edits', async () => {
        vi.mocked(prisma.documentTemplate.findFirst).mockResolvedValue({
            id: 'template-1',
            companyId: 'company-1',
            type: 'VACATION_REQUEST',
            name: 'Vacaciones personalizada',
            variables: '[]',
            isDefault: false,
            content: JSON.stringify({
                kind: 'layout-template',
                version: 1,
                elements: [
                    { id: 'title', type: 'text', x: 10, y: 5, w: 80, h: 8, text: 'SOLICITUD test 123' },
                    { id: 'logo-box', type: 'box', x: 72, y: 15, w: 18, h: 10 },
                    { id: 'logo-label', type: 'text', x: 72, y: 19, w: 18, h: 3, text: 'LOGO' }
                ]
            })
        } as never);

        const template = await CompanyDocumentTemplateService.getTemplate('VACATION_REQUEST', 'company-1');
        const layout = JSON.parse(template?.content || '{}');

        expect(layout.elements).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'title', text: 'SOLICITUD test 123' }),
            expect.objectContaining({ id: 'company-logo', type: 'logo', source: 'company' })
        ]));
        expect(layout.elements.some((element: { id?: string }) => element.id === 'logo-label')).toBe(false);
        expect(layout.elements.some((element: { id?: string }) => element.id === 'logo-box')).toBe(false);
    });

    it('resolves automatic documents against the employee company template', async () => {
        const template: ResolvedTemplate = {
            name: 'Vacaciones empresa',
            type: 'VACATION_REQUEST',
            content: '{}',
            variables: [],
            source: 'company',
            companyId: 'company-employee',
            isDefault: false
        };
        const context = {
            empleado: { dni: '12345678A' }
        } as TemplateContext;

        vi.mocked(prisma.employee.findUnique).mockResolvedValue({
            id: 'emp-1',
            companyId: 'company-employee'
        } as never);
        vi.spyOn(CompanyDocumentTemplateService, 'getTemplate').mockResolvedValue(template);
        vi.spyOn(CompanyDocumentTemplateService, 'buildContext').mockResolvedValue(context);
        vi.spyOn(CompanyDocumentTemplateService, 'renderPdfFromTemplate').mockResolvedValue({
            buffer: Buffer.from('pdf'),
            template
        });
        vi.mocked(StorageService.saveBuffer).mockResolvedValue({
            key: 'documents/EXP_emp-1/vacaciones.pdf'
        } as never);
        vi.mocked(prisma.document.create).mockResolvedValue({
            id: 'doc-1',
            name: template.name
        } as never);

        await CompanyDocumentTemplateService.generateDocumentFromTemplate({
            employeeId: 'emp-1',
            type: 'VACATION_REQUEST',
            extraContext: {
                vacacion: { dias: 5 }
            }
        });

        expect(prisma.employee.findUnique).toHaveBeenCalledWith({
            where: { id: 'emp-1' },
            select: { companyId: true }
        });
        expect(CompanyDocumentTemplateService.getTemplate).toHaveBeenCalledWith(
            'VACATION_REQUEST',
            'company-employee'
        );
        expect(CompanyDocumentTemplateService.renderPdfFromTemplate).toHaveBeenCalledWith(
            expect.objectContaining({
                companyId: 'company-employee'
            })
        );
    });
});
