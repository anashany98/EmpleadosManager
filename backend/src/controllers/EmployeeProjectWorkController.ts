import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types/express';
import { canManageEmployee, canReadEmployeeDetail } from '../policies/employeeAccess';
import { ApiResponse } from '../utils/ApiResponse';

export class EmployeeProjectWorkController {
    async getByEmployee(req: Request, res: Response) {
        try {
            const { user } = req as AuthenticatedRequest;
            const { employeeId } = req.params;
            const employee = await prisma.employee.findUnique({
                where: { id: employeeId },
                select: { id: true, companyId: true }
            });

            if (!employee) {
                return ApiResponse.error(res, 'Empleado no encontrado', 404);
            }

            if (!canReadEmployeeDetail(user, employee)) {
                return ApiResponse.error(res, 'No autorizado', 403);
            }

            const entries = await prisma.employeeProjectWork.findMany({
                where: { employeeId },
                include: { project: true },
                orderBy: { startDate: 'desc' }
            });
            return ApiResponse.success(res, entries);
        } catch (error) {
            return ApiResponse.error(res, 'Error al obtener registros de proyecto', 500);
        }
    }

    async create(req: Request, res: Response) {
        try {
            const { user } = req as AuthenticatedRequest;
            const { employeeId, projectId, startDate, endDate, hours, notes } = req.body;
            const employee = await prisma.employee.findUnique({
                where: { id: employeeId },
                select: { id: true, companyId: true }
            });

            if (!employee) {
                return ApiResponse.error(res, 'Empleado no encontrado', 404);
            }

            if (!canManageEmployee(user, employee)) {
                return ApiResponse.error(res, 'No autorizado', 403);
            }

            const entry = await prisma.employeeProjectWork.create({
                data: {
                    employeeId,
                    projectId,
                    startDate: new Date(startDate),
                    endDate: new Date(endDate),
                    hours: parseFloat(hours),
                    notes
                },
                include: { project: true }
            });
            return ApiResponse.success(res, entry, 'Registro creado', 201);
        } catch (error) {
            return ApiResponse.error(res, 'Error al crear registro', 500);
        }
    }

    async delete(req: Request, res: Response) {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const entry = await prisma.employeeProjectWork.findUnique({
                where: { id },
                include: {
                    employee: {
                        select: {
                            id: true,
                            companyId: true
                        }
                    }
                }
            });

            if (!entry) {
                return ApiResponse.error(res, 'Registro no encontrado', 404);
            }

            if (!canManageEmployee(user, entry.employee)) {
                return ApiResponse.error(res, 'No autorizado', 403);
            }

            await prisma.employeeProjectWork.delete({
                where: { id }
            });
            return ApiResponse.success(res, null, 'Registro eliminado');
        } catch (error) {
            return ApiResponse.error(res, 'Error al eliminar registro', 500);
        }
    }
}

export const employeeProjectWorkController = new EmployeeProjectWorkController();
