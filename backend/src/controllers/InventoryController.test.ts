import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks
const { mockLogger, mockGenerateTech, mockGenerateEPI, mockGenerateUniform } = vi.hoisted(() => {
    return {
        mockLogger: {
            error: vi.fn(),
            info: vi.fn(),
            warn: vi.fn()
        },
        mockGenerateTech: vi.fn(),
        mockGenerateEPI: vi.fn(),
        mockGenerateUniform: vi.fn()
    }
});

vi.mock('../services/LoggerService', () => ({
    createLogger: () => mockLogger
}));

vi.mock('../lib/prisma', () => ({
    prisma: {
        inventoryItem: {
            findUnique: vi.fn()
        }
    }
}));

vi.mock('../services/DocumentTemplateService', () => ({
    DocumentTemplateService: {
        generateTechDeviceInternal: (...args: any[]) => mockGenerateTech(...args),
        generateEPIInternal: (...args: any[]) => mockGenerateEPI(...args),
        generateUniformInternal: (...args: any[]) => mockGenerateUniform(...args)
    }
}));

vi.mock('fs', () => {
    const mockFs = {
        existsSync: vi.fn(() => true)
    };
    return {
        default: mockFs,
        ...mockFs
    };
});

vi.mock('path', () => {
    const mockPath = {
        join: (...args: string[]) => args.join('/')
    };
    return {
        default: mockPath,
        ...mockPath
    };
});

// Import AFTER mocks
import { InventoryController } from './InventoryController';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';

describe('InventoryController.generateReceipt', () => {
    let req: any;
    let res: any;

    beforeEach(() => {
        vi.clearAllMocks();
        req = {
            params: { id: 'item-123' },
            body: {
                employeeId: 'emp-123',
                deviceName: 'Test Device',
                serialNumber: 'SN-123'
            }
        };
        res = {
            download: vi.fn(),
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };

        // Setup default mocks
        mockGenerateTech.mockResolvedValue({ fileUrl: 'tech.pdf' });
        mockGenerateEPI.mockResolvedValue({ fileUrl: 'epi.pdf' });
        mockGenerateUniform.mockResolvedValue({ fileUrl: 'uniform.pdf' });
    });

    it('should generate TECH receipt for TECH category', async () => {
        (prisma.inventoryItem.findUnique as any).mockResolvedValue({
            id: 'item-123',
            category: 'TECH',
            name: 'Laptop',
            size: null
        });

        await InventoryController.generateReceipt(req, res);

        if (mockLogger.error.mock.calls.length > 0) {
            console.error('Logger error calls:', mockLogger.error.mock.calls);
        }

        expect(prisma.inventoryItem.findUnique).toHaveBeenCalledWith({ where: { id: 'item-123' } });
        expect(mockGenerateTech).toHaveBeenCalledWith('emp-123', 'Test Device', 'SN-123');
        expect(res.download).toHaveBeenCalled();
        const downloadPath = res.download.mock.calls[0][0];
        expect(downloadPath).toContain('tech.pdf');
    });

    it('should generate EPI receipt for EPI category', async () => {
        (prisma.inventoryItem.findUnique as any).mockResolvedValue({
            id: 'item-123',
            category: 'EPI',
            name: 'Gloves',
            size: 'L'
        });

        await InventoryController.generateReceipt(req, res);

        expect(mockGenerateEPI).toHaveBeenCalledWith('emp-123', [{ name: 'Test Device', size: 'L' }]);
        expect(res.download).toHaveBeenCalled();
        const downloadPath = res.download.mock.calls[0][0];
        expect(downloadPath).toContain('epi.pdf');
    });

    it('should generate Uniform receipt for CLOTHING category', async () => {
        (prisma.inventoryItem.findUnique as any).mockResolvedValue({
            id: 'item-123',
            category: 'CLOTHING',
            name: 'T-Shirt',
            size: 'M'
        });

        await InventoryController.generateReceipt(req, res);

        expect(mockGenerateUniform).toHaveBeenCalledWith('emp-123', [{ name: 'Test Device', size: 'M' }]);
        expect(res.download).toHaveBeenCalled();
    });

    it('should return error if item not found', async () => {
        (prisma.inventoryItem.findUnique as any).mockResolvedValue(null);

        await InventoryController.generateReceipt(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Artículo no encontrado' }));
    });
});
