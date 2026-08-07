import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks
const { mockLogger, mockGenerateTech, mockGenerateEPI, mockGenerateUniform } = vi.hoisted(() => ({
        mockLogger: {
            error: vi.fn(),
            info: vi.fn(),
            warn: vi.fn()
        },
        mockGenerateTech: vi.fn(),
        mockGenerateEPI: vi.fn(),
        mockGenerateUniform: vi.fn()
    }));

vi.mock('../services/LoggerService', () => ({
    createLogger: () => mockLogger
}));

vi.mock('../lib/prisma', () => ({
    prisma: {
        inventoryItem: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        },
        inventoryMovement: {
            create: vi.fn()
        },
        asset: {
            count: vi.fn(),
            create: vi.fn()
        },
        $transaction: vi.fn()
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
        existsSync: vi.fn(() => true),
        readFileSync: vi.fn(),
        unlinkSync: vi.fn()
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
import fs from 'fs';

// Mockeamos el helper compartido para que los tests no dependan
// del filesystem real. El helper en sí tiene su propio test
// exhaustivo (utils/fileDownload.test.ts).
const mockServeLocalUploadFile = vi.fn();
vi.mock('../utils/fileDownload', () => ({
    serveLocalUploadFile: (...args: unknown[]) => mockServeLocalUploadFile(...args)
}));

describe('InventoryController.generateReceipt', () => {
    let req: any;
    let res: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockServeLocalUploadFile.mockImplementation(() => undefined);
        req = {
            params: { id: 'item-123' },
            body: {
                employeeId: 'emp-123',
                deviceName: 'Test Device',
                serialNumber: 'SN-123'
            }
        };
        res = {
            sendFile: vi.fn(),
            download: vi.fn(),
            setHeader: vi.fn(),
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
        // El controller delega en `serveLocalUploadFile` (helper
        // compartido que centraliza la defensa contra path
        // traversal, sanitización del nombre de descarga y
        // callback de error en sendFile). El test del helper
        // exhaustivo está en `utils/fileDownload.test.ts`.
        expect(mockServeLocalUploadFile).toHaveBeenCalledWith(res, 'tech.pdf');
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
        expect(mockServeLocalUploadFile).toHaveBeenCalledWith(res, 'epi.pdf');
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
        expect(mockServeLocalUploadFile).toHaveBeenCalled();
    });

    it('should return error if item not found', async () => {
        (prisma.inventoryItem.findUnique as any).mockResolvedValue(null);

        await InventoryController.generateReceipt(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Artículo no encontrado' }));
    });
});

describe('InventoryController.update', () => {
    let req: any;
    let res: any;
    let tx: any;

    beforeEach(() => {
        vi.clearAllMocks();
        tx = {
            inventoryItem: { findUnique: vi.fn(), update: vi.fn() },
            inventoryMovement: { create: vi.fn() }
        };
        (prisma.$transaction as any).mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(tx));
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
    });

    it('registers an ADJUSTMENT movement when quantity changes', async () => {
        req = { params: { id: 'item-1' }, body: { quantity: 12 }, user: { id: 'user-1' } };
        tx.inventoryItem.findUnique.mockResolvedValue({ quantity: 5 });
        tx.inventoryItem.update.mockResolvedValue({ id: 'item-1', quantity: 12 });

        await InventoryController.update(req, res);

        expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                inventoryItemId: 'item-1',
                type: 'ADJUSTMENT',
                quantity: 7,
                userId: 'user-1'
            })
        });
        expect(tx.inventoryItem.update).toHaveBeenCalledWith({
            where: { id: 'item-1' },
            data: expect.objectContaining({ quantity: { increment: 7 } })
        });
    });

    it('does not register a movement when quantity is unchanged', async () => {
        req = { params: { id: 'item-1' }, body: { quantity: 5 }, user: { id: 'user-1' } };
        tx.inventoryItem.findUnique.mockResolvedValue({ quantity: 5 });
        tx.inventoryItem.update.mockResolvedValue({ id: 'item-1', quantity: 5 });

        await InventoryController.update(req, res);

        expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
        // Sin delta, el update no debe tocar la cantidad
        expect(tx.inventoryItem.update).toHaveBeenCalledWith({
            where: { id: 'item-1' },
            data: expect.not.objectContaining({ quantity: expect.anything() })
        });
    });
});

describe('InventoryController.delete', () => {
    let req: any;
    let res: any;

    beforeEach(() => {
        vi.clearAllMocks();
        req = { params: { id: 'item-1' } };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
    });

    it('blocks deletion when assets are still assigned', async () => {
        (prisma.asset.count as any).mockResolvedValue(2);

        await InventoryController.delete(req, res);

        expect(prisma.inventoryItem.delete).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('deletes the item when no assigned assets remain', async () => {
        (prisma.asset.count as any).mockResolvedValue(0);
        (prisma.inventoryItem.delete as any).mockResolvedValue({ id: 'item-1' });

        await InventoryController.delete(req, res);

        expect(prisma.asset.count).toHaveBeenCalledWith({
            where: { inventoryItemId: 'item-1', status: 'ASSIGNED' }
        });
        expect(prisma.inventoryItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
    });
});

describe('InventoryController.distribute', () => {
    let req: any;
    let res: any;
    let tx: any;

    beforeEach(() => {
        vi.clearAllMocks();
        tx = {
            inventoryItem: { findUnique: vi.fn(), update: vi.fn() },
            inventoryMovement: { create: vi.fn() },
            asset: { create: vi.fn() }
        };
        tx.inventoryItem.findUnique.mockResolvedValue({ id: 'item-1', name: 'Guantes', category: 'EPI', quantity: 5 });
        (prisma.$transaction as any).mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(tx));
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
    });

    it('creates one asset per unit distributed', async () => {
        req = { params: { id: 'item-1' }, body: { employeeId: 'emp-1', quantity: 3 }, user: { id: 'user-1' } };

        await InventoryController.distribute(req, res);

        expect(tx.asset.create).toHaveBeenCalledTimes(3);
        expect(tx.inventoryItem.update).toHaveBeenCalledWith({
            where: { id: 'item-1' },
            data: { quantity: { decrement: 3 } }
        });
    });

    it('rejects distribution when stock is insufficient', async () => {
        tx.inventoryItem.findUnique.mockResolvedValue({ id: 'item-1', name: 'Guantes', category: 'EPI', quantity: 1 });
        req = { params: { id: 'item-1' }, body: { employeeId: 'emp-1', quantity: 3 }, user: { id: 'user-1' } };

        await InventoryController.distribute(req, res);

        expect(tx.asset.create).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });
});

describe('InventoryController.importCsv', () => {
    let req: any;
    let res: any;

    beforeEach(() => {
        vi.clearAllMocks();
        req = { file: { path: 'tmp/import.csv' }, user: { id: 'user-1' } };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        (prisma.inventoryMovement.create as any).mockResolvedValue({ id: 'mov-1' });
    });

    it('parses quoted fields with commas and escaped quotes', async () => {
        (fs.readFileSync as any).mockReturnValue(
            'nombre,categoria,cantidad,descripcion\n"Guantes, reforzados",EPI,4,"Resistentes a ""corte"" nivel 5"'
        );
        (prisma.inventoryItem.findFirst as any).mockResolvedValue(null);
        (prisma.inventoryItem.create as any).mockResolvedValue({ id: 'new-1' });

        await InventoryController.importCsv(req, res);

        expect(prisma.inventoryItem.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                name: 'Guantes, reforzados',
                category: 'EPI',
                quantity: 4,
                description: 'Resistentes a "corte" nivel 5'
            })
        });
        // El stock inicial queda trazado como ENTRY
        expect(prisma.inventoryMovement.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ inventoryItemId: 'new-1', type: 'ENTRY', quantity: 4 })
        });
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ created: 1, errors: 0 })
        }));
    });

    it('strips UTF-8 BOM so the first header matches', async () => {
        (fs.readFileSync as any).mockReturnValue('\uFEFFnombre,cantidad\nCasco,2');
        (prisma.inventoryItem.findFirst as any).mockResolvedValue(null);
        (prisma.inventoryItem.create as any).mockResolvedValue({ id: 'new-2' });

        await InventoryController.importCsv(req, res);

        expect(prisma.inventoryItem.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ name: 'Casco', quantity: 2 })
        });
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ errors: 0 })
        }));
    });

    it('logs an ENTRY movement when incrementing an existing item', async () => {
        (fs.readFileSync as any).mockReturnValue('nombre,cantidad\nGuantes,3');
        (prisma.inventoryItem.findFirst as any).mockResolvedValue({
            id: 'ex-1', category: 'EPI', sku: null, brand: null, unitPrice: null
        });
        (prisma.inventoryItem.update as any).mockResolvedValue({ id: 'ex-1' });

        await InventoryController.importCsv(req, res);

        expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
            where: { id: 'ex-1' },
            data: expect.objectContaining({ quantity: { increment: 3 } })
        });
        expect(prisma.inventoryMovement.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ inventoryItemId: 'ex-1', type: 'ENTRY', quantity: 3, notes: 'Importación CSV' })
        });
    });

    it('rejects rows with invalid quantity without persisting them', async () => {
        (fs.readFileSync as any).mockReturnValue('nombre,cantidad\nCasco,abc\nMascara,-2');

        await InventoryController.importCsv(req, res);

        expect(prisma.inventoryItem.create).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ created: 0, errors: 2 })
        }));
    });

    it('accepts headers exported by the app (round-trip export -> import)', async () => {
        // Cabeceras exactas que genera handleExportCSV en el frontend
        (fs.readFileSync as any).mockReturnValue(
            '"Nombre","Categoria","Cantidad","Stock Minimo","Talla","SKU","Marca","Precio Unitario","Proveedor","Ubicacion"\n"Guantes","EPI","10","3","L","G-01","3M","4.50","ACME","A-01"'
        );
        (prisma.inventoryItem.findFirst as any).mockResolvedValue(null);
        (prisma.inventoryItem.create as any).mockResolvedValue({ id: 'new-3' });

        await InventoryController.importCsv(req, res);

        expect(prisma.inventoryItem.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                name: 'Guantes',
                category: 'EPI',
                quantity: 10,
                minQuantity: 3,
                size: 'L',
                sku: 'G-01',
                brand: '3M',
                unitPrice: 4.5,
                supplier: 'ACME',
                warehouseLocation: 'A-01'
            })
        });
    });
});
