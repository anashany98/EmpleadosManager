import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types/express';
import { canManageEmployee, canReadEmployeeDetail } from '../policies/employeeAccess';
import { ApiResponse } from '../utils/ApiResponse';
import { Prisma } from '@prisma/client';

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

            // Filtro opcional por rango de fechas (solape): sirve para
            // imputar horas a obras desde el control horario (un día o un
            // mes completos) sin traer todo el historial del empleado.
            const { from, to } = req.query;
            const where: Prisma.EmployeeProjectWorkWhereInput = { employeeId };
            if (from || to) {
                const gte = from ? new Date(String(from)) : null;
                const lte = to ? new Date(String(to)) : null;
                const validFrom = gte && !isNaN(gte.getTime());
                const validTo = lte && !isNaN(lte.getTime());
                if (validFrom || validTo) {
                    where.AND = [
                        ...(validFrom ? [{ endDate: { gte: gte } }] : []),
                        ...(validTo ? [{ startDate: { lte: lte } }] : [])
                    ];
                }
            }

            const entries = await prisma.employeeProjectWork.findMany({
                where,
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

            const start = new Date(startDate);
            const end = new Date(endDate);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return ApiResponse.error(res, 'Fechas inválidas', 400);
            }
            if (start > end) {
                return ApiResponse.error(res, 'endDate debe ser posterior o igual a startDate', 400);
            }

            const entry = await prisma.employeeProjectWork.create({
                data: {
                    employeeId,
                    projectId,
                    startDate: start,
                    endDate: end,
                    hours: parseFloat(hours),
                    notes: notes ?? null
                },
                include: { project: true }
            });
            return ApiResponse.success(res, entry, 'Registro creado', 201);
        } catch (error) {
            return ApiResponse.error(res, 'Error al crear registro', 500);
        }
    }

    async update(req: Request, res: Response) {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const { startDate, endDate, hours, notes } = req.body || {};

            const existing = await prisma.employeeProjectWork.findUnique({
                where: { id },
                include: { employee: { select: { id: true, companyId: true } } }
            });

            if (!existing) {
                return ApiResponse.error(res, 'Registro no encontrado', 404);
            }

            if (!canManageEmployee(user, existing.employee)) {
                return ApiResponse.error(res, 'No autorizado', 403);
            }

            const newStart = startDate ? new Date(startDate) : existing.startDate;
            const newEnd = endDate ? new Date(endDate) : existing.endDate;
            if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
                return ApiResponse.error(res, 'Fechas inválidas', 400);
            }
            if (newStart > newEnd) {
                return ApiResponse.error(res, 'endDate debe ser posterior o igual a startDate', 400);
            }

            const updated = await prisma.employeeProjectWork.update({
                where: { id },
                data: {
                    startDate: startDate ? new Date(startDate) : undefined,
                    endDate: endDate ? new Date(endDate) : undefined,
                    hours: hours != null ? parseFloat(hours) : undefined,
                    notes: notes !== undefined ? notes : undefined
                },
                include: { project: true }
            });
            return ApiResponse.success(res, updated, 'Registro actualizado');
        } catch (error) {
            return ApiResponse.error(res, 'Error al actualizar registro', 500);
        }
    }

    async listByProject(req: Request, res: Response) {
        try {
            const { user } = req as AuthenticatedRequest;
            const { projectId } = req.params;

            if (user.role !== 'admin' && !user.companyId) {
                return ApiResponse.error(res, 'No autorizado', 403);
            }

            const entries = await prisma.employeeProjectWork.findMany({
                where: { projectId },
                include: { employee: { select: { id: true, name: true, firstName: true, lastName: true, dni: true } } },
                orderBy: { startDate: 'desc' }
            });
            return ApiResponse.success(res, entries);
        } catch (error) {
            return ApiResponse.error(res, 'Error al obtener registros', 500);
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
