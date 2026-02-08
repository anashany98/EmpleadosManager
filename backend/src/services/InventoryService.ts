import { prisma } from '../lib/prisma';
import { NotificationService } from './NotificationService';

export const InventoryService = {
    /**
     * Checks stock levels for an item and triggers an alert if below minimum.
     */
    checkStockLevels: async (itemId: string) => {
        const item = await prisma.inventoryItem.findUnique({
            where: { id: itemId }
        });

        if (!item) return;

        if (item.quantity <= item.minQuantity) {
            const severity = item.quantity === 0 ? 'CRITICAL' : 'WARNING';
            const message = item.quantity === 0
                ? `STOCK AGOTADO: ${item.name}${item.size ? ` (Talla ${item.size})` : ''}`
                : `Stock bajo (${item.quantity}): ${item.name}${item.size ? ` (Talla ${item.size})` : ''}. Mínimo: ${item.minQuantity}`;

            // Create Alert in DB
            await prisma.alert.create({
                data: {
                    type: 'INVENTORY_STOCK',
                    severity,
                    title: 'Alerta de Inventario',
                    message,
                    actionUrl: `/inventory`, // Link to inventory management
                    metadata: JSON.stringify({ itemId, currentStock: item.quantity, minStock: item.minQuantity })
                } as any
            });

            // Notify Admins via UI/Push
            await NotificationService.notifyAdmins(
                'Alerta de Stock',
                message,
                '/inventory'
            );

            console.log(`[InventoryService] Alert triggered for ${item.name}: ${message}`);
        }
    },

    /**
     * Records a movement and checks stock.
     */
    recordMovement: async (data: {
        itemId: string,
        type: 'ENTRY' | 'ASSIGNMENT' | 'RETURN' | 'ADJUSTMENT',
        quantity: number,
        userId: string,
        employeeId?: string,
        notes?: string
    }) => {
        const movement = await prisma.inventoryMovement.create({
            data: {
                inventoryItemId: data.itemId,
                type: data.type,
                quantity: data.quantity,
                userId: data.userId,
                employeeId: data.employeeId,
                notes: data.notes
            }
        });

        // Update item quantity
        const multiplier = (data.type === 'ENTRY' || data.type === 'RETURN') ? 1 : -1;
        await prisma.inventoryItem.update({
            where: { id: data.itemId },
            data: { quantity: { increment: data.quantity * multiplier } }
        });

        // Trigger stock check
        await InventoryService.checkStockLevels(data.itemId);

        return movement;
    },

    /**
     * Returns an asset to inventory.
     */
    returnAsset: async (assetId: string, userId: string, notes?: string) => {
        const asset = await prisma.asset.findUnique({
            where: { id: assetId }
        });

        if (!asset || !asset.inventoryItemId) {
            throw new Error('Asset not linked to inventory');
        }

        // 1. Mark asset as RETURNED
        await prisma.asset.update({
            where: { id: assetId },
            data: { status: 'RETURNED', returnDate: new Date() }
        });

        // 2. Record inventory ENTRY
        return await InventoryService.recordMovement({
            itemId: asset.inventoryItemId,
            type: 'RETURN',
            quantity: 1,
            userId,
            employeeId: asset.employeeId || undefined,
            notes: notes || 'Devolución de material'
        });
    }
};
