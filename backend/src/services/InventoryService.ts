import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { NotificationService } from './NotificationService';
import { createLogger } from './LoggerService';

const logger = createLogger('InventoryService');

/**
 * Error thrown when a stock decrement would drive `InventoryItem.quantity`
 * below the requested amount. This is the signal to callers (document
 * services, offboarding, etc.) that the operation must NOT proceed and
 * the user must be told why.
 */
export class InsufficientStockError extends Error {
    readonly code = 'INSUFFICIENT_STOCK';
    constructor(public readonly itemId: string, public readonly requested: number, public readonly available: number) {
        super('INSUFFICIENT_STOCK');
        this.name = 'InsufficientStockError';
    }
}

/**
 * InventoryService — owns the invariants of the inventory subsystem:
 *
 *   1. Every movement of stock (ENTRY, ASSIGNMENT, RETURN, ADJUSTMENT)
 *      is recorded in the same DB transaction that updates the
 *      `InventoryItem.quantity`. The movement log and the on-hand
 *      quantity can never disagree.
 *   2. Decrements are conditional: a decrement only succeeds if the
 *      current quantity is at least the requested amount. This is
 *      enforced atomically at the SQL level with `updateMany` and a
 *      `where: { quantity: { gte: requested } }` guard. Two concurrent
 *      assignments on a stock=1 item cannot both succeed.
 *   3. `returnAsset` is a single business operation that must always
 *      either fully succeed (asset marked RETURNED + stock re-credited
 *      + RETURN movement logged) or fully fail. There is no
 *      intermediate state where the asset is returned but the stock
 *      wasn't re-credited.
 *   4. Side-effects that are not part of the business invariant
 *      (push notifications, low-stock alert dispatch) happen AFTER
 *      the transaction commits, so a notification failure cannot
 *      roll back stock changes.
 */
export const InventoryService = {
    /**
     * Atomically decrement the quantity of an inventory item by `amount`
     * IF AND ONLY IF the current quantity is >= `amount`. Throws
     * `InsufficientStockError` if not enough stock is available.
     *
     * Implemented as a conditional `updateMany` so the check-and-set
     * is a single SQL statement. Two concurrent calls on a stock=1
     * item will see exactly one succeed and one throw.
     */
    async decrementStockIfAvailable(itemId: string, amount: number): Promise<void> {
        if (!Number.isInteger(amount) || amount <= 0) {
            throw new Error(`Invalid decrement amount: ${amount}`);
        }
        const result = await prisma.inventoryItem.updateMany({
            where: { id: itemId, quantity: { gte: amount } },
            data: { quantity: { decrement: amount } }
        });
        if (result.count === 0) {
            // Read the current quantity for the error message; this is
            // best-effort and only used for diagnostics.
            const current = await prisma.inventoryItem.findUnique({
                where: { id: itemId },
                select: { quantity: true }
            });
            throw new InsufficientStockError(itemId, amount, current?.quantity ?? 0);
        }
    },

    /**
     * Atomically increment the quantity of an inventory item by
     * `amount`. No guard — used for ENTRY (purchase) and RETURN
     * (asset returned to stock). Both are valid operations that
     * never fail for "insufficient stock" reasons.
     */
    async incrementStock(itemId: string, amount: number): Promise<void> {
        if (!Number.isInteger(amount) || amount <= 0) {
            throw new Error(`Invalid increment amount: ${amount}`);
        }
        await prisma.inventoryItem.update({
            where: { id: itemId },
            data: { quantity: { increment: amount } }
        });
    },

    /**
     * Records a stock movement and updates the item's quantity in a
     * single DB transaction. ENTRY/RETURN increment; ASSIGNMENT
     * decrements with the atomic compare-and-set guard;
     * ADJUSTMENT applies the signed delta to the quantity.
     *
     * The low-stock alert (`checkStockLevels`) runs INSIDE the
     * transaction so the alert is consistent with the post-movement
     * quantity. Push notifications happen AFTER the commit.
     */
    async recordMovement(data: {
        itemId: string;
        type: 'ENTRY' | 'ASSIGNMENT' | 'RETURN' | 'ADJUSTMENT';
        quantity: number;
        userId: string;
        employeeId?: string;
        notes?: string;
    }): Promise<{ id: string; type: string; quantity: number; createdAt: Date }> {
        const movement = await prisma.$transaction(async (tx) => {
            // 1. Insert the movement row.
            const created = await tx.inventoryMovement.create({
                data: {
                    inventoryItemId: data.itemId,
                    type: data.type,
                    quantity: data.quantity,
                    userId: data.userId,
                    employeeId: data.employeeId,
                    notes: data.notes
                }
            });

            // 2. Update the on-hand quantity atomically. For
            //    ASSIGNMENT we use the compare-and-set decrement so
            //    two concurrent assignments cannot drive stock
            //    negative. For ENTRY and RETURN we increment without
            //    a guard (they are always valid). For ADJUSTMENT we
            //    apply the signed delta.
            if (data.type === 'ASSIGNMENT') {
                const result = await tx.inventoryItem.updateMany({
                    where: { id: data.itemId, quantity: { gte: data.quantity } },
                    data: { quantity: { decrement: data.quantity } }
                });
                if (result.count === 0) {
                    const current = await tx.inventoryItem.findUnique({
                        where: { id: data.itemId },
                        select: { quantity: true }
                    });
                    throw new InsufficientStockError(data.itemId, data.quantity, current?.quantity ?? 0);
                }
            } else if (data.type === 'ENTRY' || data.type === 'RETURN') {
                await tx.inventoryItem.update({
                    where: { id: data.itemId },
                    data: { quantity: { increment: data.quantity } }
                });
            } else if (data.type === 'ADJUSTMENT') {
                // ADJUSTMENT quantity is signed: positive = +
                // inventory, negative = write-off. We do the
                // compare-and-set in a single SQL statement.
                if (data.quantity < 0) {
                    const result = await tx.inventoryItem.updateMany({
                        where: { id: data.itemId, quantity: { gte: Math.abs(data.quantity) } },
                        data: { quantity: { decrement: Math.abs(data.quantity) } }
                    });
                    if (result.count === 0) {
                        const current = await tx.inventoryItem.findUnique({
                            where: { id: data.itemId },
                            select: { quantity: true }
                        });
                        throw new InsufficientStockError(data.itemId, Math.abs(data.quantity), current?.quantity ?? 0);
                    }
                } else {
                    await tx.inventoryItem.update({
                        where: { id: data.itemId },
                        data: { quantity: { increment: data.quantity } }
                    });
                }
            }

            // 3. Check stock level and persist the alert (if any) in
            //    the SAME transaction so the alert row reflects the
            //    post-movement quantity. The push notification happens
            //    after commit.
            await checkStockLevelsInternal(tx, data.itemId);

            return created;
        });

        // Side-effect: notify admins. Done after commit so a
        // notification failure cannot roll back the stock change.
        try {
            const item = await prisma.inventoryItem.findUnique({
                where: { id: data.itemId },
                select: { quantity: true, minQuantity: true, name: true, size: true }
            });
            if (item && item.quantity <= item.minQuantity) {
                const severity = item.quantity === 0 ? 'CRITICAL' : 'WARNING';
                const message = item.quantity === 0
                    ? `STOCK AGOTADO: ${item.name}${item.size ? ` (Talla ${item.size})` : ''}`
                    : `Stock bajo (${item.quantity}): ${item.name}${item.size ? ` (Talla ${item.size})` : ''}. Mínimo: ${item.minQuantity}`;
                await NotificationService.notifyAdmins('Alerta de Stock', message, '/inventory');
                logger.info({ itemId: data.itemId, quantity: item.quantity, severity }, 'Stock alert dispatched');
            }
        } catch (err) {
            logger.warn({ err, itemId: data.itemId }, 'Failed to dispatch stock alert notification (stock change is already committed)');
        }

        return movement;
    },

    /**
     * Returns an asset to inventory. Marks the asset as RETURNED AND
     * records the inventory movement in a single transaction. If any
     * step fails, both are rolled back so the asset is never
     * RETURNED-without-stock nor has-stock-but-still-ASSIGNED.
     */
    async returnAsset(assetId: string, userId: string, notes?: string): Promise<{ id: string; type: string; quantity: number; createdAt: Date }> {
        return prisma.$transaction(async (tx) => {
            // 1. Load the asset; verify it is linked to an inventory
            //    item and capture the link.
            const asset = await tx.asset.findUnique({
                where: { id: assetId }
            });
            if (!asset || !asset.inventoryItemId) {
                throw new Error('Asset not linked to inventory');
            }

            // 2. Mark the asset as RETURNED. This is the irreversible
            //    "the employee no longer has it" marker.
            await tx.asset.update({
                where: { id: assetId },
                data: { status: 'RETURNED', returnDate: new Date() }
            });

            // 3. Record the inventory movement and increment the
            //    item's stock. Both in the same transaction.
            const movement = await tx.inventoryMovement.create({
                data: {
                    inventoryItemId: asset.inventoryItemId,
                    type: 'RETURN',
                    quantity: 1,
                    userId,
                    employeeId: asset.employeeId || undefined,
                    notes: notes || 'Devolución de material'
                }
            });
            await tx.inventoryItem.update({
                where: { id: asset.inventoryItemId },
                data: { quantity: { increment: 1 } }
            });

            // 4. Re-check stock level in the same transaction.
            await checkStockLevelsInternal(tx, asset.inventoryItemId);

            return movement;
        });
    },

    /**
     * Read-only check: returns the current stock and whether the item
     * is below its minimum. Convenience wrapper used by external
     * callers (e.g. dashboard) that don't need the side-effect of
     * creating an alert.
     */
    async checkStockLevels(itemId: string): Promise<{ quantity: number; minQuantity: number; below: boolean } | null> {
        const item = await prisma.inventoryItem.findUnique({
            where: { id: itemId },
            select: { quantity: true, minQuantity: true, name: true, size: true }
        });
        if (!item) {
            return null;
        }
        return {
            quantity: item.quantity,
            minQuantity: item.minQuantity,
            below: item.quantity <= item.minQuantity
        };
    },

    /**
     * Pre-flight check for a batch of items. Throws
     * `InsufficientStockError` with the first item that does not have
     * enough stock. Use this BEFORE doing expensive work (PDF
     * generation, file upload) to fail fast and avoid partial
     * side-effects.
     *
     * NOTE: this check is best-effort: between the read and the
     * actual decrement, another concurrent request could consume the
     * stock. The atomic guarantee comes from the `quantity: { gte }`
     * guard in `decrementStockIfAvailable` / `recordMovement`. This
     * helper just spares us from generating a PDF when we already
     * know we're going to fail.
     */
    async assertStockForItems(items: Array<{ itemId: string; quantity: number }>): Promise<void> {
        for (const { itemId, quantity } of items) {
            if (!Number.isInteger(quantity) || quantity <= 0) {
                throw new Error(`Invalid quantity for ${itemId}: ${quantity}`);
            }
            const item = await prisma.inventoryItem.findUnique({
                where: { id: itemId },
                select: { quantity: true, name: true, size: true }
            });
            if (!item) {
                throw new InsufficientStockError(itemId, quantity, 0);
            }
            if (item.quantity < quantity) {
                throw new InsufficientStockError(itemId, quantity, item.quantity);
            }
        }
    },

    /**
     * Transaction-aware variant of `recordMovement`. Use this when
     * the movement must be part of a larger business transaction
     * (e.g. document generation: document + movement + asset in one
     * commit). The caller passes the `tx` client and is responsible
     * for opening and committing the outer transaction.
     *
     * Same atomicity guarantees as `recordMovement`:
     *   - ASSIGNMENT uses conditional `updateMany` so stock cannot
     *     go negative.
     *   - The post-movement stock check + alert creation happen in
     *     the same transaction.
     *   - The push notification is NOT performed here — the caller
     *     must do it after the outer transaction commits.
     */
    async recordMovementInTx(
        tx: Prisma.TransactionClient,
        data: {
            itemId: string;
            type: 'ENTRY' | 'ASSIGNMENT' | 'RETURN' | 'ADJUSTMENT';
            quantity: number;
            userId: string;
            employeeId?: string;
            notes?: string;
        }
    ): Promise<{ id: string; type: string; quantity: number; createdAt: Date }> {
        const created = await tx.inventoryMovement.create({
            data: {
                inventoryItemId: data.itemId,
                type: data.type,
                quantity: data.quantity,
                userId: data.userId,
                employeeId: data.employeeId,
                notes: data.notes
            }
        });

        if (data.type === 'ASSIGNMENT') {
            const result = await tx.inventoryItem.updateMany({
                where: { id: data.itemId, quantity: { gte: data.quantity } },
                data: { quantity: { decrement: data.quantity } }
            });
            if (result.count === 0) {
                const current = await tx.inventoryItem.findUnique({
                    where: { id: data.itemId },
                    select: { quantity: true }
                });
                throw new InsufficientStockError(data.itemId, data.quantity, current?.quantity ?? 0);
            }
        } else if (data.type === 'ENTRY' || data.type === 'RETURN') {
            await tx.inventoryItem.update({
                where: { id: data.itemId },
                data: { quantity: { increment: data.quantity } }
            });
        } else if (data.type === 'ADJUSTMENT') {
            if (data.quantity < 0) {
                const result = await tx.inventoryItem.updateMany({
                    where: { id: data.itemId, quantity: { gte: Math.abs(data.quantity) } },
                    data: { quantity: { decrement: Math.abs(data.quantity) } }
                });
                if (result.count === 0) {
                    const current = await tx.inventoryItem.findUnique({
                        where: { id: data.itemId },
                        select: { quantity: true }
                    });
                    throw new InsufficientStockError(data.itemId, Math.abs(data.quantity), current?.quantity ?? 0);
                }
            } else {
                await tx.inventoryItem.update({
                    where: { id: data.itemId },
                    data: { quantity: { increment: data.quantity } }
                });
            }
        }

        await checkStockLevelsInternal(tx, data.itemId);
        return created;
    }
};

/**
 * Internal helper: runs inside a `$transaction` callback and creates
 * a stock alert row if the post-movement quantity is at or below
 * `minQuantity`. Returns nothing.
 */
async function checkStockLevelsInternal(tx: Prisma.TransactionClient, itemId: string): Promise<void> {
    const item = await tx.inventoryItem.findUnique({
        where: { id: itemId },
        select: { quantity: true, minQuantity: true, name: true, size: true }
    });
    if (!item) {
        return;
    }
    if (item.quantity > item.minQuantity) {
        return;
    }
    const severity = item.quantity === 0 ? 'CRITICAL' : 'WARNING';
    const message = item.quantity === 0
        ? `STOCK AGOTADO: ${item.name}${item.size ? ` (Talla ${item.size})` : ''}`
        : `Stock bajo (${item.quantity}): ${item.name}${item.size ? ` (Talla ${item.size})` : ''}. Mínimo: ${item.minQuantity}`;
    await tx.alert.create({
        data: {
            type: 'INVENTORY_STOCK',
            severity,
            title: 'Alerta de Inventario',
            message,
            actionUrl: `/inventory`,
            metadata: { itemId, currentStock: item.quantity, minStock: item.minQuantity }
        }
    });
}
