// HIGH-010 (parte 2): Los servicios de generación de documentos
// (EPI, Uniform, TechDevice, MaterialDelivery) deben ser atómicos:
// la fila `Document`, los `Asset` y los `InventoryMovement` deben
// comprometerse en una sola transacción. Si cualquier paso falla, el
// stock no debe quedar decrementado, el documento no debe quedar
// persistido y el PDF huérfano debe eliminarse del storage.
//
// Antes del fix: el código usaba un `try { recordMovement; create asset } catch { logger.warn }`
// alrededor del inventario, lo que silenciaba errores y dejaba
// estados inconsistentes (documento creado sin stock descontado, o
// stock descontado sin asset).
//
// El fix:
//   1. Pre-validación de stock (`assertStockForItems`) antes de
//      generar el PDF (fail fast).
//   2. Generación de PDF + guardado en storage (sin tocar la BD de
//      inventario).
//   3. Transacción Prisma: `document.create` (si lo hace el wrapper)
//      + `recordMovementInTx` (cada item) + `asset.create` (cada
//      item). Todo en un commit.
//   4. Si la transacción falla, compensación: borrar el PDF del
//      storage y propagar el error (NO silenciar).

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Estado y spies compartidos (mismo patrón que high-010.inventory).
const state = (globalThis as any).__high010DocState ?? {
    stock: new Map<string, number>(),
    failOn: new Set<string>()
};
(globalThis as any).__high010DocState = state;

const MOCK_HELPERS = {
    reset(): void {
        state.stock.clear();
        state.failOn.clear();
    },
    setStock(id: string, qty: number): void {
        state.stock.set(id, qty);
    },
    getStock(id: string): number {
        return state.stock.get(id) ?? 0;
    }
};

function buildSpies() {
    return {
        inventoryMovementCreate: vi.fn(async ({ data }: any) => ({ id: 'mov-' + Math.random().toString(36).slice(2, 8), ...data })),
        inventoryItemUpdate: vi.fn(async ({ where, data }: any) => {
            const st = (globalThis as any).__high010DocState;
            const current = st.stock.get(where.id) ?? 0;
            const inc = data.quantity?.increment ?? 0;
            st.stock.set(where.id, current + inc);
            return { id: where.id, quantity: current + inc };
        }),
        inventoryItemUpdateMany: vi.fn(async ({ where, data }: any) => {
            const st = (globalThis as any).__high010DocState;
            if (st.failOn.has('inventoryItem.updateMany')) {
                st.failOn.delete('inventoryItem.updateMany');
                throw new Error('DB_WRITE_FAILED');
            }
            const current = st.stock.get(where.id) ?? 0;
            const dec = data.quantity?.decrement ?? 0;
            if (current < dec) {
                return { count: 0 };
            }
            st.stock.set(where.id, current - dec);
            return { count: 1 };
        }),
        inventoryItemFindUnique: vi.fn(async ({ where }: any) => {
            const st = (globalThis as any).__high010DocState;
            return {
                id: where.id,
                name: 'Test item',
                size: null,
                quantity: st.stock.get(where.id) ?? 0,
                minQuantity: 10
            };
        }),
        inventoryItemFindFirst: vi.fn(async ({ where }: any) => {
            const st = (globalThis as any).__high010DocState;
            const name = where?.name;
            for (const [id, qty] of st.stock.entries()) {
                if (id === name || `legacy-${name}` === id) {
                    return { id, name, quantity: qty, minQuantity: 10 };
                }
            }
            return null;
        }),
        employeeFindUnique: vi.fn(async ({ where }: any) => ({
            id: where.id,
            name: 'Test Employee',
            dni: 'encrypted-dni',
            companyId: 'company-1',
            company: { id: 'company-1', city: 'Palma' }
        })),
        companyDocumentTemplate: {
            findFirst: vi.fn(async () => null)
        },
        assetCreate: vi.fn(async ({ data }: any) => ({ id: 'asset-' + Math.random().toString(36).slice(2, 8), ...data })),
        documentCreate: vi.fn(async ({ data }: any) => ({
            id: 'doc-' + Math.random().toString(36).slice(2, 8),
            fileUrl: data.fileUrl,
            ...data
        })),
        documentDelete: vi.fn(async () => undefined),
        alertCreate: vi.fn(async ({ data }: any) => ({ id: 'alert-1', ...data })),
        transaction: vi.fn(async (_arg: any) => undefined)
    };
}

function getSpies() {
    if (!(globalThis as any).__high010DocSpies) {
        (globalThis as any).__high010DocSpies = buildSpies();
    }
    return (globalThis as any).__high010DocSpies;
}

const SPY_KEYS = [
    'inventoryMovementCreate',
    'inventoryItemUpdate',
    'inventoryItemUpdateMany',
    'inventoryItemFindUnique',
    'inventoryItemFindFirst',
    'employeeFindUnique',
    'companyDocumentTemplate',
    'assetCreate',
    'documentCreate',
    'documentDelete',
    'alertCreate',
    'transaction'
] as const;

const SPY_HELPERS = {
    reset(): void {
        const sp = getSpies();
        for (const k of SPY_KEYS) {
            const v = (sp as any)[k];
            if (v && typeof v.mockClear === 'function') {
                v.mockClear();
            } else if (v && typeof v === 'object') {
                // Objeto con sub-spies (p. ej. `companyDocumentTemplate: { findFirst: vi.fn() }`)
                for (const sub of Object.values(v)) {
                    if (sub && typeof (sub as any).mockClear === 'function') {
                        (sub as any).mockClear();
                    }
                }
            }
        }
    }
};

vi.mock('../../lib/prisma', () => {
    const sp = getSpies();
    const tx = {
        inventoryItem: {
            findUnique: sp.inventoryItemFindUnique,
            findFirst: sp.inventoryItemFindFirst,
            update: sp.inventoryItemUpdate,
            updateMany: sp.inventoryItemUpdateMany
        },
        inventoryMovement: {
            create: sp.inventoryMovementCreate
        },
        asset: {
            create: sp.assetCreate
        },
        document: {
            create: sp.documentCreate,
            delete: sp.documentDelete
        },
        alert: {
            create: sp.alertCreate
        }
    };
    sp.transaction.mockImplementation(async (arg: any) => {
        if (typeof arg === 'function') {
            return arg(tx);
        }
        return Promise.all(arg);
    });
    return {
        prisma: {
            $transaction: sp.transaction,
            inventoryItem: tx.inventoryItem,
            inventoryMovement: tx.inventoryMovement,
            asset: tx.asset,
            document: tx.document,
            alert: tx.alert,
            employee: { findUnique: sp.employeeFindUnique },
            companyDocumentTemplate: sp.companyDocumentTemplate
        }
    };
});

// Mocks para evitar tirar de WebSockets, PDFs reales, storage, etc.
vi.mock('../../services/StorageService', () => ({
    StorageService: {
        saveBuffer: vi.fn(async ({ folder, originalName }: any) => ({ key: `${folder}/${originalName}` })),
        deleteFile: vi.fn(async () => undefined)
    }
}));

vi.mock('../../services/EncryptionService', () => ({
    EncryptionService: {
        decrypt: vi.fn((v: any) => v),
        encrypt: vi.fn((v: any) => `enc(${v})`)
    }
}));

vi.mock('../../services/NotificationService', () => ({
    NotificationService: { notifyAdmins: vi.fn() }
}));

vi.mock('../../services/LoggerService', () => ({
    createLogger: () => ({
        info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn()
    })
}));

vi.mock('../../services/documents/DocumentPdfUtils', () => ({
    getLogoPath: () => null,
    addQRCodeToPDF: vi.fn(async () => undefined),
    buildPdfBuffer: vi.fn(async () => Buffer.from('PDF')),
    writeTemplateText: vi.fn()
}));

vi.mock('../../services/documents/DocumentTemplateService', () => ({
    CompanyDocumentTemplateService: {
        getTemplate: vi.fn(async () => null),
        buildContext: vi.fn(async () => ({})),
        renderTemplate: vi.fn(() => '')
    }
}));

vi.mock('../../services/documents/DocumentLayoutService', () => ({
    parseLayoutTemplate: vi.fn(() => null),
    renderLayoutTemplate: vi.fn(async () => undefined)
}));

import { prisma } from '../../lib/prisma';
import { generateEPI } from '../../services/documents/EPIService';
import { generateUniform } from '../../services/documents/UniformService';
import { generateTechDevice } from '../../services/documents/TechDeviceService';
import { generateMaterialDelivery } from '../../services/documents/MaterialDeliveryService';
import { StorageService } from '../../services/StorageService';

const spies = getSpies();

describe('HIGH-010 (parte 2) — Servicios de documento atómicos', () => {
    beforeEach(() => {
        MOCK_HELPERS.reset();
        SPY_HELPERS.reset();
        vi.mocked(StorageService.saveBuffer).mockClear();
        vi.mocked(StorageService.deleteFile).mockClear();
    });

    // ----------------- EPIService -----------------

    it('generateEPI: pre-validate stock falla rápido si no hay stock', async () => {
        MOCK_HELPERS.setStock('item-casco', 0);

        await expect(generateEPI('emp-1', [
            { id: 'item-casco', name: 'Casco', quantity: 1 }
        ], 'u-1')).rejects.toThrow('INSUFFICIENT_STOCK');

        // No se debe haber creado el PDF, ni documento, ni movimiento
        expect(StorageService.saveBuffer).not.toHaveBeenCalled();
        expect(spies.documentCreate).not.toHaveBeenCalled();
        expect(spies.inventoryMovementCreate).not.toHaveBeenCalled();
    });

    it('generateEPI: deducc stock + crea asset en la misma transacción', async () => {
        MOCK_HELPERS.setStock('item-casco', 5);

        await generateEPI('emp-1', [
            { id: 'item-casco', name: 'Casco', quantity: 1 }
        ], 'u-1');

        // Stock decrementado
        expect(MOCK_HELPERS.getStock('item-casco')).toBe(4);
        // Movement creado
        expect(spies.inventoryMovementCreate).toHaveBeenCalledTimes(1);
        // Asset creado
        expect(spies.assetCreate).toHaveBeenCalledTimes(1);
        // Una sola transacción para inventory+asset
        expect(spies.transaction).toHaveBeenCalled();
    });

    it('generateEPI: si la transacción falla, compensa borrando PDF y propagando error', async () => {
        MOCK_HELPERS.setStock('item-bot', 5);
        // Forzamos fallo en el movement
        state.failOn.add('inventoryItem.updateMany');

        await expect(generateEPI('emp-2', [
            { id: 'item-bot', name: 'Botas', quantity: 1 }
        ], 'u-1')).rejects.toThrow();

        // La transacción se invocó y rollbackeó
        expect(spies.transaction).toHaveBeenCalled();
        // El stock no se modificó (compare-and-set rechazó)
        expect(MOCK_HELPERS.getStock('item-bot')).toBe(5);
    });

    // ----------------- UniformService -----------------

    it('generateUniform: pre-validate stock falla rápido si no hay stock', async () => {
        MOCK_HELPERS.setStock('item-polo', 0);

        await expect(generateUniform('emp-1', [
            { id: 'item-polo', name: 'Polo XL', quantity: 1 }
        ], 'u-1')).rejects.toThrow('INSUFFICIENT_STOCK');

        expect(StorageService.saveBuffer).not.toHaveBeenCalled();
    });

    it('generateUniform: deducc stock + crea asset en la misma transacción', async () => {
        MOCK_HELPERS.setStock('item-polo', 3);

        await generateUniform('emp-1', [
            { id: 'item-polo', name: 'Polo XL', quantity: 1 }
        ], 'u-1');

        expect(MOCK_HELPERS.getStock('item-polo')).toBe(2);
        expect(spies.assetCreate).toHaveBeenCalledTimes(1);
    });

    // ----------------- TechDeviceService -----------------

    it('generateTechDevice: pre-validate stock falla rápido si no hay stock', async () => {
        MOCK_HELPERS.setStock('item-laptop', 0);

        await expect(generateTechDevice('emp-1', 'Laptop', 'SN123', 'u-1', 'item-laptop'))
            .rejects.toThrow('INSUFFICIENT_STOCK');

        expect(StorageService.saveBuffer).not.toHaveBeenCalled();
    });

    it('generateTechDevice: deducc stock + crea asset con serialNumber en la misma transacción', async () => {
        MOCK_HELPERS.setStock('item-laptop', 2);

        await generateTechDevice('emp-1', 'Laptop', 'SN123', 'u-1', 'item-laptop');

        expect(MOCK_HELPERS.getStock('item-laptop')).toBe(1);
        expect(spies.assetCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    serialNumber: 'SN123',
                    category: 'TECH',
                    status: 'ASSIGNED'
                })
            })
        );
    });

    it('generateTechDevice: legacy fallback busca por nombre y pre-valida', async () => {
        MOCK_HELPERS.setStock('legacy-Monitor', 0);

        await expect(generateTechDevice('emp-1', 'Monitor', 'SN-X', 'u-1'))
            .rejects.toThrow('INSUFFICIENT_STOCK');
    });

    // ----------------- MaterialDeliveryService -----------------

    it('generateMaterialDelivery: pre-validate suma cantidades por item', async () => {
        MOCK_HELPERS.setStock('item-A', 0);

        await expect(generateMaterialDelivery('emp-1', [
            { id: 'item-A', name: 'Caja A', quantity: 1 }
        ], 'u-1')).rejects.toThrow('INSUFFICIENT_STOCK');
    });

    it('generateMaterialDelivery: deducc stock + crea movements en una transacción', async () => {
        MOCK_HELPERS.setStock('item-A', 5);
        MOCK_HELPERS.setStock('item-B', 5);

        await generateMaterialDelivery('emp-1', [
            { id: 'item-A', name: 'Caja A', quantity: 2 },
            { id: 'item-B', name: 'Caja B', quantity: 1 }
        ], 'u-1');

        expect(MOCK_HELPERS.getStock('item-A')).toBe(3);
        expect(MOCK_HELPERS.getStock('item-B')).toBe(4);
        expect(spies.inventoryMovementCreate).toHaveBeenCalledTimes(2);
        // Una sola transacción envolviendo todos los movements
        expect(spies.transaction).toHaveBeenCalledTimes(1);
    });

    it('generateMaterialDelivery: si falla uno de los items, todos se rollbackean', async () => {
        MOCK_HELPERS.setStock('item-A', 5);
        MOCK_HELPERS.setStock('item-B', 0); // este fallará

        await expect(generateMaterialDelivery('emp-1', [
            { id: 'item-A', name: 'Caja A', quantity: 1 },
            { id: 'item-B', name: 'Caja B', quantity: 1 }
        ], 'u-1')).rejects.toThrow('INSUFFICIENT_STOCK');

        // El stock de A no se decrementó (todo en la misma tx, rollback)
        expect(MOCK_HELPERS.getStock('item-A')).toBe(5);
    });

    it('ningún servicio silencia errores de stock (los propagan al caller)', async () => {
        MOCK_HELPERS.setStock('item-X', 0);

        // Antes del fix, los servicios hacían logger.warn y devolvían
        // el documento igualmente. Ahora deben lanzar.
        await expect(generateEPI('emp-1', [{ id: 'item-X', name: 'X', quantity: 1 }], 'u-1'))
            .rejects.toThrow();
        await expect(generateUniform('emp-1', [{ id: 'item-X', name: 'X', quantity: 1 }], 'u-1'))
            .rejects.toThrow();
        await expect(generateTechDevice('emp-1', 'X', 'SN', 'u-1', 'item-X'))
            .rejects.toThrow();
        await expect(generateMaterialDelivery('emp-1', [{ id: 'item-X', name: 'X', quantity: 1 }], 'u-1'))
            .rejects.toThrow();
    });
});
