import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';

export const ContractService = {
    /**
     * Extender un contrato de empleado
     */
    async extendContract(employeeId: string, data: { newEndDate: string; notes?: string; fileUrl?: string }) {
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
        });

        if (!employee) {
            throw new AppError('Empleado no encontrado', 404);
        }

        const previousEndDate = employee.contractEndDate;

        return await prisma.$transaction(async (tx) => {
            // 1. Crear el registro de extensión
            const extension = await tx.contractExtension.create({
                data: {
                    employeeId,
                    newEndDate: new Date(data.newEndDate),
                    previousEndDate: previousEndDate,
                    notes: data.notes,
                    fileUrl: data.fileUrl,
                },
            });

            // 2. Actualizar la fecha fin de contrato en el perfil del empleado
            await tx.employee.update({
                where: { id: employeeId },
                data: {
                    contractEndDate: new Date(data.newEndDate),
                },
            });

            return extension;
        });
    },

    /**
     * Obtener el historial de contratos de un empleado
     */
    async getContractHistory(employeeId: string) {
        return await prisma.contractExtension.findMany({
            where: { employeeId },
            orderBy: { createdAt: 'desc' },
        });
    },
};
