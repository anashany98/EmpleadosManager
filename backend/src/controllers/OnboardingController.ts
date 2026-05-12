import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { OnboardingService } from '../services/OnboardingService';
import { AuthenticatedRequest } from '../types/express';
import { canReadEmployeeDetail, canSelfEditEmployee, canManageEmployee } from '../policies/employeeAccess';
import { isGlobalAdmin } from '../utils/companyAccess';

export const OnboardingController = {
    // Automation
    startOnboardingProcess: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { employeeId, options } = req.body;

            if (!employeeId || !options) {
                return ApiResponse.error(res, 'Faltan datos requeridos (employeeId, options)', 400);
            }

            const user = (req as any).user;
            // Inject author name into options if not present
            options.authorName = user?.name || 'RRHH / Admin';

            const results = await OnboardingService.startOnboarding(employeeId, options);

            return ApiResponse.success(res, results, 'Proceso de onboarding iniciado');
        } catch (error) {
            next(error);
        }
    },

    // Templates
    getTemplates: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const where = isGlobalAdmin(user)
                ? { isActive: true }
                : {
                    isActive: true,
                    OR: [
                        { companyId: user.companyId || null },
                        { companyId: null }
                    ]
                };

            const templates = await prisma.onboardingTemplate.findMany({
                where,
                orderBy: { createdAt: 'desc' }
            });

            // Parse items JSON
            const formatted = templates.map((t: any) => ({
                ...t,
                items: JSON.parse(t.items)
            }));

            return ApiResponse.success(res, formatted);
        } catch (error) {
            next(error);
        }
    },

    createTemplate: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { title, description, items, companyId } = req.body;

            // Validations
            if (!title || !items || !Array.isArray(items)) {
                return ApiResponse.error(res, 'Título e items son requeridos', 400);
            }

            const template = await prisma.onboardingTemplate.create({
                data: {
                    title,
                    description,
                    items: JSON.stringify(items), // Store as JSON string [ "Item 1", "Item 2" ]
                    companyId: isGlobalAdmin(user) ? companyId || null : user.companyId || null
                }
            });

            return ApiResponse.success(res, template, 'Plantilla creada correctamente', 201);
        } catch (error) {
            next(error);
        }
    },

    // Employee Checklists
    assignTemplate: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { employeeId, templateId } = req.body;

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

            const template = await prisma.onboardingTemplate.findUnique({
                where: { id: templateId }
            });

            if (!template) {
                return ApiResponse.error(res, 'Plantilla no encontrada', 404);
            }

            // Convert template items (string[]) to checkilst items ({ text: string, completed: boolean })
            const templateItems: string[] = JSON.parse(template.items);
            const checklistItems = templateItems.map(text => ({
                text,
                completed: false
            }));

            const onboarding = await prisma.employeeOnboarding.create({
                data: {
                    employeeId,
                    title: template.title,
                    items: JSON.stringify(checklistItems),
                    status: 'PENDING',
                    progress: 0
                }
            });

            return ApiResponse.success(res, onboarding, 'Checklist asignado correctamente', 201);
        } catch (error) {
            next(error);
        }
    },

    getEmployeeChecklists: async (req: Request, res: Response, next: NextFunction) => {
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

            const checklists = await prisma.employeeOnboarding.findMany({
                where: { employeeId },
                orderBy: { createdAt: 'desc' }
            });

            const formatted = checklists.map((c: any) => ({
                ...c,
                items: JSON.parse(c.items)
            }));

            return ApiResponse.success(res, formatted);
        } catch (error) {
            next(error);
        }
    },

    updateChecklist: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { user } = req as AuthenticatedRequest;
            const { id } = req.params;
            const { items } = req.body; // Expecting full array of items { text, completed }

            if (!items || !Array.isArray(items)) {
                return ApiResponse.error(res, 'Items inválidos', 400);
            }

            const checklist = await prisma.employeeOnboarding.findUnique({
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

            if (!checklist) {
                return ApiResponse.error(res, 'Checklist no encontrado', 404);
            }

            if (!canManageEmployee(user, checklist.employee) && !canSelfEditEmployee(user, checklist.employee)) {
                return ApiResponse.error(res, 'No autorizado', 403);
            }

            // Calculate progress
            const total = items.length;
            const completed = items.filter((i: any) => i.completed).length;
            const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
            const status = progress === 100 ? 'COMPLETED' : 'IN_PROGRESS';
            const completedAt = progress === 100 ? new Date() : null;

            const updated = await prisma.employeeOnboarding.update({
                where: { id },
                data: {
                    items: JSON.stringify(items),
                    progress,
                    status,
                    completedAt
                }
            });

            return ApiResponse.success(res, { ...updated, items: JSON.parse(updated.items) });
        } catch (error) {
            next(error);
        }
    },

    deleteChecklist: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            await prisma.employeeOnboarding.delete({
                where: { id }
            });
            return ApiResponse.success(res, null, 'Checklist eliminado');
        } catch (error) {
            next(error);
        }
    }
};
