import { prisma } from '../lib/prisma';
import { InventoryService } from './InventoryService';
import { AppError } from '../utils/AppError';

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

        const exitDate = new Date(options.exitDate);
        await prisma.$transaction(async (tx) => {
            const employee = await tx.employee.findUnique({ where: { id: employeeId } });
            if (!employee) throw new AppError('Empleado no encontrado', 404);
            if (!employee.active) throw new AppError('El empleado ya está dado de baja', 409);
            if (!employee.companyId) throw new AppError('El empleado debe estar asociado a una empresa', 409);

            const openPeriod = await tx.employmentPeriod.findFirst({
                where: { employeeId, endDate: null },
                orderBy: { startDate: 'desc' }
            });
            if (openPeriod) {
                await tx.employmentPeriod.update({
                    where: { id: openPeriod.id },
                    data: { endDate: exitDate, endReason: options.reason, endedById: options.userId }
                });
            } else {
                await tx.employmentPeriod.create({
                    data: {
                        employeeId,
                        companyId: employee.companyId,
                        startDate: employee.entryDate || employee.createdAt,
                        endDate: exitDate,
                        startReason: 'Periodo reconstruido al tramitar la baja',
                        endReason: options.reason,
                        endedById: options.userId
                    }
                });
            }

            await tx.employee.update({
                where: { id: employeeId },
                data: { active: false, exitDate, lowReason: options.reason }
            });
            await tx.user.updateMany({
                where: { employeeId },
                data: { isActive: false, sessionVersion: { increment: 1 } }
            });
            await tx.auditLog.create({
                data: {
                    action: 'OFFBOARD_EMPLOYEE',
                    entity: 'EMPLOYEE',
                    entityId: employeeId,
                    targetEmployeeId: employeeId,
                    userId: options.userId,
                    metadata: JSON.stringify({
                        exitDate: exitDate.toISOString(),
                        reason: options.reason,
                        assetsReturned: results.assetsReturned
                    })
                }
            });
        });
        results.deactivated = true;

        return results;
    },

    reactivateEmployee: async (employeeId: string, options: {
        reactivationDate: string;
        reason: string;
        userId: string;
    }) => {
        const reactivationDate = new Date(options.reactivationDate);
        return prisma.$transaction(async (tx) => {
            const employee = await tx.employee.findUnique({ where: { id: employeeId } });
            if (!employee) throw new AppError('Empleado no encontrado', 404);
            if (employee.active) throw new AppError('El empleado ya está activo', 409);
            if (!employee.companyId) throw new AppError('El empleado debe estar asociado a una empresa', 409);
            if (employee.exitDate && reactivationDate < employee.exitDate) {
                throw new AppError('La fecha de reactivación no puede ser anterior a la última baja', 422);
            }
            const openPeriod = await tx.employmentPeriod.findFirst({
                where: { employeeId, endDate: null }
            });
            if (openPeriod) throw new AppError('El empleado ya tiene un periodo laboral abierto', 409);

            const previousExit = {
                exitDate: employee.exitDate?.toISOString() || null,
                lowReason: employee.lowReason || null
            };
            await tx.employmentPeriod.create({
                data: {
                    employeeId,
                    companyId: employee.companyId,
                    startDate: reactivationDate,
                    startReason: options.reason,
                    createdById: options.userId
                }
            });
            const updated = await tx.employee.update({
                where: { id: employeeId },
                data: {
                    active: true,
                    exitDate: null,
                    lowReason: null
                }
            });
            await tx.user.updateMany({
                where: { employeeId },
                data: { isActive: true, failedLoginAttempts: 0, lockedUntil: null, sessionVersion: { increment: 1 } }
            });
            await tx.auditLog.create({
                data: {
                    action: 'REACTIVATE_EMPLOYEE',
                    entity: 'EMPLOYEE',
                    entityId: employeeId,
                    targetEmployeeId: employeeId,
                    userId: options.userId,
                    metadata: JSON.stringify({
                        reactivationDate: reactivationDate.toISOString(),
                        reason: options.reason,
                        previousExit
                    })
                }
            });
            return updated;
        });
    }
};
