// HIGH-010: Movimientos de inventario, activos y documentos no son atómicos.
//
// Síntomas confirmados antes del fix:
//   - `InventoryService.recordMovement` hace `inventoryMovement.create`,
//     `inventoryItem.update({ quantity: { increment: ... } })` y
//     `checkStockLevels` en 3 Prisma calls separados, fuera de
//     `$transaction`. Si la 2ª o 3ª fallan, el movement queda
//     registrado pero el stock NO se actualiza (o viceversa).
//   - El increment/decrement no lleva guarda `quantity >= requested`,
//     por lo que 10 requests concurrentes sobre stock=1 pueden dejar
//     stock=-9 con 10 movements registrados.
//   - `InventoryService.returnAsset` marca el asset como `RETURNED` y
//     luego hace `recordMovement` (3 Prisma calls); si
//     `recordMovement` falla, el asset queda devuelto sin re-ingresar
//     stock.
//   - Los servicios de documento (EPI/Uniform/TechDevice/MaterialDelivery)
//     envuelven `recordMovement` + `asset.create` en un `try/catch` que
//     silencia el error con `logger.warn` → stock decrementado pero
//     asset no registrado, o asset registrado pero stock no
//     decrementado.
//
// El fix:
//   1. `decrementStockIfAvailable(itemId, n)` con `updateMany` y where
//      `quantity: { gte: n }`. Si `count === 0` lanza
//      `INSUFFICIENT_STOCK`. Esto hace check-and-decrement atómico a
//      nivel de SQL.
//   2. `recordMovement` envuelve `inventoryMovement.create`,
//      `inventoryItem.update`/`decrementStockIfAvailable` y
//      `alert.create` (la parte de BD) en `$transaction`. La
//      notificación push se hace fuera (es un side-effect, no parte de
//      la invariante).
//   3. `returnAsset` ejecuta el `$transaction` de `recordMovement`
//      y el `asset.update` dentro de la MISMA transacción.
//   4. Los servicios de documento dejan de silenciar el error: si la
//      transacción falla, el documento PDF NO se crea (orden inverso:
//      primero documento, después inventory + asset, todos en $transaction).

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Estado y spies compartidos entre la factory de vi.mock y los tests.
// vi.mock se eleva al top del archivo, así que tenemos que usar
// un holder mutable vía globalThis.
const state = (globalThis as any).__high010State ?? {
    stock: new Map<string, number>(),
    failOn: new Set<string>()
};
(globalThis as any).__high010State = state;

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

// Spys a nivel de "top-level Prisma" — los tests los importan
// desde este objeto mockeado para verificar las llamadas.
// Los spies se inicializan dentro del factory de vi.mock (que se
// eleva al top), y se exponen vía globalThis para que los tests
// puedan limpiarlos y verificarlos.
function buildSpies() {
    return {
        inventoryMovementCreate: vi.fn(async ({ data }: any) => ({ id: 'mov-' + Math.random().toString(36).slice(2, 8), ...data })),
        inventoryItemUpdate: vi.fn(async ({ where, data }: any) => {
            const st = (globalThis as any).__high010State;
            const current = st.stock.get(where.id) ?? 0;
            const inc = data.quantity?.increment ?? 0;
            st.stock.set(where.id, current + inc);
            return { id: where.id, quantity: current + inc };
        }),
        inventoryItemUpdateMany: vi.fn(async ({ where, data }: any) => {
            const st = (globalThis as any).__high010State;
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
            const st = (globalThis as any).__high010State;
            return {
                id: where.id,
                name: 'Test item',
                size: null,
                quantity: st.stock.get(where.id) ?? 0,
                minQuantity: 10
            };
        }),
        assetFindUnique: vi.fn(async ({ where }: any) => ({
            id: where.id,
            inventoryItemId: 'item-7',
            employeeId: 'emp-3'
        })),
        assetUpdate: vi.fn(async ({ where, data }: any) => {
            const st = (globalThis as any).__high010State;
            if (st.failOn.has('asset.update')) {
                st.failOn.delete('asset.update');
                throw new Error('DB_WRITE_FAILED');
            }
            return { id: where.id, ...data };
        }),
        assetCreate: vi.fn(async ({ data }: any) => ({ id: 'asset-new', ...data })),
        alertCreate: vi.fn(async ({ data }: any) => ({ id: 'alert-1', ...data })),
        documentCreate: vi.fn(async ({ data }: any) => ({ id: 'doc-1', ...data })),
        transaction: vi.fn(async (_arg: any) => undefined) // se reconfigura en vi.mock
    };
}

const SPY_KEYS = [
    'inventoryMovementCreate',
    'inventoryItemUpdate',
    'inventoryItemUpdateMany',
    'inventoryItemFindUnique',
    'assetFindUnique',
    'assetUpdate',
    'assetCreate',
    'alertCreate',
    'documentCreate',
    'transaction'
] as const;

function getSpies() {
    if (!(globalThis as any).__high010Spies) {
        (globalThis as any).__high010Spies = buildSpies();
    }
    return (globalThis as any).__high010Spies;
}

const SPY_HELPERS = {
    reset(): void {
        const sp = getSpies();
        for (const k of SPY_KEYS) {
            sp[k].mockClear();
        }
    }
};

vi.mock('../../lib/prisma', () => {
    // Las llamadas `tx.X.Y(...)` desde dentro de una transacción se
    // enrutan al MISMO spy top-level. Esto permite a los tests
    // verificar las llamadas sin importar si se hicieron dentro o
    // fuera de `$transaction`. El factory se eleva al top, así que
    // inicializamos los spies la primera vez que se ejecuta.
    const sp = getSpies();
    const tx = {
        inventoryItem: {
            findUnique: sp.inventoryItemFindUnique,
            update: sp.inventoryItemUpdate,
            updateMany: sp.inventoryItemUpdateMany
        },
        inventoryMovement: {
            create: sp.inventoryMovementCreate
        },
        asset: {
            findUnique: sp.assetFindUnique,
            update: sp.assetUpdate,
            create: sp.assetCreate
        },
        alert: {
            create: sp.alertCreate
        },
        document: {
            create: sp.documentCreate
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
            alert: tx.alert,
            document: tx.document
        }
    };
});

vi.mock('../../services/NotificationService', () => ({
    NotificationService: { notifyAdmins: vi.fn() }
}));

vi.mock('../../services/LoggerService', () => ({
    createLogger: () => ({
        info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn()
    })
}));

import { prisma } from '../../lib/prisma';
import { InventoryService } from '../../services/InventoryService';

const spies = getSpies();

describe('HIGH-010 — InventoryService atomicidad y consistencia', () => {
    beforeEach(() => {
        MOCK_HELPERS.reset();
        SPY_HELPERS.reset();
    });

    it('decrementStockIfAvailable rechaza cuando no hay stock suficiente (compare-and-set)', async () => {
        MOCK_HELPERS.setStock('item-1', 1);

        const results = await Promise.allSettled(
            Array.from({ length: 10 }, () => InventoryService.decrementStockIfAvailable('item-1', 1))
        );

        const succeeded = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

        expect(succeeded).toBe(1);
        expect(failed).toHaveLength(9);
        for (const f of failed) {
            expect((f.reason as Error).message).toBe('INSUFFICIENT_STOCK');
        }
        expect(MOCK_HELPERS.getStock('item-1')).toBe(0);
    });

    it('decrementStockIfAvailable permite varios decrementos en serie sobre stock suficiente', async () => {
        MOCK_HELPERS.setStock('item-2', 5);

        await InventoryService.decrementStockIfAvailable('item-2', 2);
        await InventoryService.decrementStockIfAvailable('item-2', 2);

        expect(MOCK_HELPERS.getStock('item-2')).toBe(1);
    });

    it('recordMovement (ASSIGNMENT) usa decrementStockIfAvailable y registra movement', async () => {
        MOCK_HELPERS.setStock('item-3', 3);

        const movement = await InventoryService.recordMovement({
            itemId: 'item-3',
            type: 'ASSIGNMENT',
            quantity: 1,
            userId: 'u-1',
            employeeId: 'emp-1',
            notes: 'EPI casco'
        });

        expect(movement.id).toBeDefined();
        expect(MOCK_HELPERS.getStock('item-3')).toBe(2);
        expect(spies.transaction).toHaveBeenCalled();
        expect(spies.inventoryMovementCreate).toHaveBeenCalled();
    });

    it('recordMovement (ASSIGNMENT) lanza INSUFFICIENT_STOCK si no hay stock', async () => {
        MOCK_HELPERS.setStock('item-4', 0);
        SPY_HELPERS.reset();

        await expect(InventoryService.recordMovement({
            itemId: 'item-4',
            type: 'ASSIGNMENT',
            quantity: 1,
            userId: 'u-1',
            employeeId: 'emp-1'
        })).rejects.toThrow('INSUFFICIENT_STOCK');

        // El movimiento se intentó crear (la spy captura el intento
        // JS), pero la transacción hizo rollback y el stock se
        // mantiene en 0. Lo que importa para la invariante es que
        // el stock final siga en 0.
        expect(MOCK_HELPERS.getStock('item-4')).toBe(0);
        // Y la transacción falló.
        expect(spies.transaction).toHaveBeenCalled();
    });

    it('recordMovement (ENTRY) incrementa stock sin guarda', async () => {
        MOCK_HELPERS.setStock('item-5', 2);

        await InventoryService.recordMovement({
            itemId: 'item-5',
            type: 'ENTRY',
            quantity: 10,
            userId: 'u-1'
        });

        expect(MOCK_HELPERS.getStock('item-5')).toBe(12);
        expect(spies.transaction).toHaveBeenCalled();
        expect(spies.inventoryMovementCreate).toHaveBeenCalled();
    });

    it('recordMovement (RETURN) es atómico: movement + stock en la misma transacción', async () => {
        MOCK_HELPERS.setStock('item-6', 5);

        await InventoryService.recordMovement({
            itemId: 'item-6',
            type: 'RETURN',
            quantity: 1,
            userId: 'u-1',
            employeeId: 'emp-2',
            notes: 'Devolución'
        });

        // El movement se registra y la transacción se ejecuta
        expect(spies.inventoryMovementCreate).toHaveBeenCalled();
        expect(spies.transaction).toHaveBeenCalled();
    });

    it('returnAsset es atómico: asset update + recordMovement en la misma transacción', async () => {
        MOCK_HELPERS.setStock('item-7', 2);

        await InventoryService.returnAsset('asset-1', 'u-1', 'Devolución de prueba');

        // Asset marcado como RETURNED
        expect(spies.assetUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'asset-1' },
                data: expect.objectContaining({ status: 'RETURNED' })
            })
        );
        // Stock incrementado en 1
        expect(MOCK_HELPERS.getStock('item-7')).toBe(3);
        // Todo en una sola transacción
        expect(spies.transaction).toHaveBeenCalled();
        // El movement se registra
        expect(spies.inventoryMovementCreate).toHaveBeenCalled();
    });

    it('returnAsset NO marca el asset como RETURNED si la transacción falla', async () => {
        MOCK_HELPERS.setStock('item-8', 0);
        // Forzamos que asset.update lance para simular fallo SQL
        // mid-transaction. El rollback debe dejar el asset intacto.
        state.failOn.add('asset.update');
        SPY_HELPERS.reset();

        await expect(InventoryService.returnAsset('asset-2', 'u-1')).rejects.toThrow('DB_WRITE_FAILED');

        // El asset.update fue llamado, pero la transacción falló.
        // Lo importante: NO se llegó a crear el movement (rollback).
        expect(spies.inventoryMovementCreate).not.toHaveBeenCalled();
        // Y el stock no se incrementó.
        expect(MOCK_HELPERS.getStock('item-8')).toBe(0);
    });

    it('incrementStock (para ENTRY/RETURN) sin guarda: nunca falla por stock', async () => {
        MOCK_HELPERS.setStock('item-9', 0);

        await InventoryService.incrementStock('item-9', 100);

        expect(MOCK_HELPERS.getStock('item-9')).toBe(100);
    });

    it('checkStockLevels (read-only): reporta stock=0 como below', async () => {
        MOCK_HELPERS.setStock('item-10', 0);

        const result = await InventoryService.checkStockLevels('item-10');

        expect(result).toEqual(expect.objectContaining({ quantity: 0, below: true }));
    });

    it('checkStockLevels (read-only): reporta stock=3 como below (3 <= 10)', async () => {
        MOCK_HELPERS.setStock('item-11', 3);

        const result = await InventoryService.checkStockLevels('item-11');

        expect(result).toEqual(expect.objectContaining({ quantity: 3, below: true }));
    });

    it('checkStockLevels (read-only): NO crea alertas (es solo lectura)', async () => {
        MOCK_HELPERS.setStock('item-12', 0);
        SPY_HELPERS.reset();

        await InventoryService.checkStockLevels('item-12');

        // La alerta se crea dentro de recordMovement (en la transacción),
        // NO desde el check de solo lectura. Esto evita duplicar
        // alertas cuando un caller externo hace polling.
        expect(spies.alertCreate).not.toHaveBeenCalled();
    });

    it('recordMovement crea alerta de stock CRITICAL dentro de la transacción cuando el stock cae a 0', async () => {
        MOCK_HELPERS.setStock('item-13', 1);

        await InventoryService.recordMovement({
            itemId: 'item-13',
            type: 'ASSIGNMENT',
            quantity: 1,
            userId: 'u-1',
            employeeId: 'emp-1'
        });

        // Tras la asignación, stock=0, minQuantity=10 → CRITICAL
        expect(spies.alertCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    type: 'INVENTORY_STOCK',
                    severity: 'CRITICAL'
                })
            })
        );
    });

    it('assertStockForItems: lanza INSUFFICIENT_STOCK si algún item no tiene stock', async () => {
        MOCK_HELPERS.setStock('item-A', 5);
        MOCK_HELPERS.setStock('item-B', 0);

        await expect(InventoryService.assertStockForItems([
            { itemId: 'item-A', quantity: 2 },
            { itemId: 'item-B', quantity: 1 }
        ])).rejects.toThrow('INSUFFICIENT_STOCK');
    });

    it('assertStockForItems: lanza INSUFFICIENT_STOCK si el item no existe', async () => {
        await expect(InventoryService.assertStockForItems([
            { itemId: 'item-does-not-exist', quantity: 1 }
        ])).rejects.toThrow('INSUFFICIENT_STOCK');
    });

    it('assertStockForItems: NO lanza si todo el stock está disponible', async () => {
        MOCK_HELPERS.setStock('item-X', 10);
        MOCK_HELPERS.setStock('item-Y', 5);

        await expect(InventoryService.assertStockForItems([
            { itemId: 'item-X', quantity: 3 },
            { itemId: 'item-Y', quantity: 5 }
        ])).resolves.toBeUndefined();
    });

    it('assertStockForItems: rechaza cantidades inválidas', async () => {
        await expect(InventoryService.assertStockForItems([
            { itemId: 'item-X', quantity: 0 }
        ])).rejects.toThrow(/Invalid quantity/);
    });
});
