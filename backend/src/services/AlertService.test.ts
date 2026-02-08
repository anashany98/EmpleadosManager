import { describe, it, expect, vi, beforeEach } from 'vitest';
import { alertService } from './AlertService';
import { prisma } from '../lib/prisma';

// Mock Prisma
vi.mock('../lib/prisma', () => ({
    prisma: {
        inventoryItem: {
            findMany: vi.fn(),
            fields: { minQuantity: 'minQuantity' }
        },
        employee: {
            findMany: vi.fn(),
        },
        medicalReview: {
            findMany: vi.fn(),
        },
        document: {
            findMany: vi.fn(),
        },
        alert: {
            findFirst: vi.fn(),
            create: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
        }
    }
}));

describe('AlertService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateStockAlerts', () => {
        it('should generate alerts for low stock items', async () => {
            // Mock low stock item
            const mockItem = { id: 'item-1', name: 'Gloves', size: 'M', quantity: 2, minQuantity: 5 };
            (prisma.inventoryItem.findMany as any).mockResolvedValue([mockItem]);

            // Mock no existing alert
            (prisma.alert.findFirst as any).mockResolvedValue(null);

            await alertService.generateStockAlerts();

            expect(prisma.alert.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    type: 'LOW_STOCK',
                    severity: 'HIGH',
                    title: 'Stock Bajo',
                    message: expect.stringContaining('Gloves')
                })
            }));
        });

        it('should skip alert if already exists recently', async () => {
            const mockItem = { id: 'item-1', name: 'Gloves', size: 'M', quantity: 2, minQuantity: 5 };
            (prisma.inventoryItem.findMany as any).mockResolvedValue([mockItem]);

            // Mock existing alert
            (prisma.alert.findFirst as any).mockResolvedValue({ id: 'alert-1' });

            await alertService.generateStockAlerts();

            expect(prisma.alert.create).not.toHaveBeenCalled();
        });
    });

    describe('runAllChecks', () => {
        it('should run both contract and stock checks', async () => {
            // Spy on internal methods
            const contractSpy = vi.spyOn(alertService, 'generateContractAlerts');
            const stockSpy = vi.spyOn(alertService, 'generateStockAlerts');

            // Mock DB calls to return empty to avoid execution errors
            (prisma.inventoryItem.findMany as any).mockResolvedValue([]);
            (prisma.employee.findMany as any).mockResolvedValue([]);
            (prisma.medicalReview.findMany as any).mockResolvedValue([]);
            (prisma.document.findMany as any).mockResolvedValue([]);

            await alertService.runAllChecks();

            expect(contractSpy).toHaveBeenCalled();
            expect(stockSpy).toHaveBeenCalled();
        });
    });
});
