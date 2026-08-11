import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({
    prisma: {
        obraExpense: {
            findMany: vi.fn()
        }
    }
}));

vi.mock('./AuditService', () => ({
    AuditService: {
        log: vi.fn()
    }
}));

vi.mock('./documents/DocumentTemplateService', () => ({
    CompanyDocumentTemplateService: {
        getStoredTemplate: vi.fn(),
        buildContext: vi.fn(),
        renderPdfFromTemplate: vi.fn()
    }
}));

import { prisma } from '../lib/prisma';
import { CompanyDocumentTemplateService } from './documents/DocumentTemplateService';
import { ObraExpenseReceiptService } from './ObraExpenseReceiptService';

describe('ObraExpenseReceiptService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders diet receipts through the effective OBRA_EXPENSE_RECEIPT template even without a stored override', async () => {
        const expense = {
            id: 'expense-1',
            type: 'PER_DIEM',
            date: new Date('2026-07-01T00:00:00.000Z'),
            endDate: new Date('2026-07-03T00:00:00.000Z'),
            amount: 150,
            unitAmount: 50,
            unitCount: 3,
            currency: 'EUR',
            description: 'Dieta de desplazamiento',
            destination: 'Madrid',
            employeeId: 'employee-1',
            obraId: 'obra-1',
            obra: {
                id: 'obra-1',
                code: 'OB-001',
                name: 'Reforma',
                destination: 'Madrid'
            },
            employee: {
                id: 'employee-1',
                name: 'Ana Ejemplo',
                firstName: 'Ana',
                lastName: 'Ejemplo',
                dni: 'encrypted-dni',
                company: {
                    id: 'company-1',
                    name: 'Empresa Ejemplo'
                }
            }
        };
        const baseContext = {
            empleado: {
                nombreCompleto: 'Ana Ejemplo',
                dni: '12345678A'
            },
            empresa: {
                nombre: 'Empresa Ejemplo'
            }
        };
        const configuredPdf = Buffer.from('configured-template-pdf');

        vi.mocked(prisma.obraExpense.findMany).mockResolvedValue([expense] as never);
        vi.mocked(CompanyDocumentTemplateService.buildContext).mockResolvedValue(baseContext as never);
        vi.mocked(CompanyDocumentTemplateService.renderPdfFromTemplate).mockResolvedValue({
            buffer: configuredPdf,
            template: {
                type: 'OBRA_EXPENSE_RECEIPT',
                name: 'Recibí de dietas y gastos'
            }
        } as never);

        const result = await ObraExpenseReceiptService.generate(['expense-1'], 'user-1');

        expect(CompanyDocumentTemplateService.buildContext).toHaveBeenCalledWith(
            'employee-1',
            expect.objectContaining({
                extraContext: expect.objectContaining({
                    obra: expect.objectContaining({ codigo: 'OB-001' }),
                    gasto: expect.objectContaining({
                        concepto: 'Dietas',
                        dias: 3
                    })
                })
            })
        );
        expect(CompanyDocumentTemplateService.renderPdfFromTemplate).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'OBRA_EXPENSE_RECEIPT',
                companyId: 'company-1',
                employeeId: 'employee-1',
                context: expect.objectContaining({
                    empleado: expect.objectContaining({ dni: '12345678A' })
                })
            })
        );
        expect(result.buffer).toEqual(configuredPdf);
    });
});
