import { prisma } from '../lib/prisma';
import { InventoryService } from './InventoryService';

export const OffboardingService = {
    /**
     * Gets all data needed for offboarding an employee.
     */
    getOffboardingData: async (employeeId: string) => {
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            include: {
                assets: {
                    where: { status: 'ASSIGNED' },
                    include: { inventoryItem: true }
                },
                vacations: {
                    where: { status: 'APPROVED' }
                }
            }
        });

        if (!employee) throw new Error('Empleado no encontrado');

        // Logic for calculating holidays, etc. could go here
        return {
            employee,
            pendingAssets: employee.assets,
            // Add more data like pending loans, training to complete, etc.
        };
    },

    /**
     * Completes the offboarding process.
     */
    completeOffboarding: async (employeeId: string, options: {
        exitDate: string,
        reason: string,
        returnAssets: string[], // IDs of assets returned
        userId: string
    }) => {
        const results = {
            assetsReturned: 0,
            deactivated: false,
            errors: [] as string[]
        };

        // 1. Process Asset Returns
        if (options.returnAssets.length > 0) {
            for (const assetId of options.returnAssets) {
                try {
                    await InventoryService.returnAsset(assetId, options.userId, 'Devolución por cese laboral');
                    results.assetsReturned++;
                } catch (err: any) {
                    results.errors.push(`Error devolviendo activo ${assetId}: ${err.message}`);
                }
            }
        }

        // 2. Mark Employee as inactive
        await prisma.employee.update({
            where: { id: employeeId },
            data: {
                active: false,
                exitDate: new Date(options.exitDate),
                lowReason: options.reason
            }
        });
        results.deactivated = true;

        // 3. Deactivate User Account
        const user = await prisma.user.findFirst({ where: { employeeId } });
        if (user) {
            await prisma.user.update({
                where: { id: user.id },
                data: { role: 'inactive' } // Or however we handle disabled users
            });
        }

        return results;
    }
};
