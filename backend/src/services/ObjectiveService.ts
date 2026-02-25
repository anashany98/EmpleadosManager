import { prisma } from '../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

interface CreateObjectiveData {
    employeeId: string;
    evaluationId?: string;
    title: string;
    description?: string;
    category?: string;
    targetValue?: number;
    unit?: string;
    weight?: number;
    startDate: Date;
    dueDate: Date;
    parentObjectiveId?: string;
}

interface UpdateObjectiveData {
    title?: string;
    description?: string;
    category?: string;
    targetValue?: number;
    actualValue?: number;
    unit?: string;
    weight?: number;
    status?: string;
    progress?: number;
    achievementScore?: number;
    managerComments?: string;
    completedAt?: Date;
}

export class ObjectiveService {
    // Crear objetivo
    static async createObjective(data: CreateObjectiveData) {
        return prisma.objective.create({
            data: {
                employeeId: data.employeeId,
                evaluationId: data.evaluationId,
                title: data.title,
                description: data.description,
                category: data.category || 'PERFORMANCE',
                targetValue: data.targetValue ? new Decimal(data.targetValue) : null,
                unit: data.unit,
                weight: data.weight ? new Decimal(data.weight) : new Decimal(1),
                startDate: data.startDate,
                dueDate: data.dueDate,
                parentObjectiveId: data.parentObjectiveId,
                status: 'NOT_STARTED'
            },
            include: {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });
    }

    // Obtener objetivo por ID
    static async getObjectiveById(id: string) {
        return prisma.objective.findUnique({
            where: { id },
            include: {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        firstName: true,
                        lastName: true,
                        jobTitle: true,
                        department: true
                    }
                },
                childObjectives: true,
                parentObjective: true
            }
        });
    }

    // Listar objetivos
    static async listObjectives(filters: {
        employeeId?: string;
        status?: string;
        category?: string;
        dueDateFrom?: Date;
        dueDateTo?: Date;
    }) {
        const where: any = {};

        if (filters.employeeId) where.employeeId = filters.employeeId;
        if (filters.status) where.status = filters.status;
        if (filters.category) where.category = filters.category;
        if (filters.dueDateFrom || filters.dueDateTo) {
            where.dueDate = {};
            if (filters.dueDateFrom) where.dueDate.gte = filters.dueDateFrom;
            if (filters.dueDateTo) where.dueDate.lte = filters.dueDateTo;
        }

        return prisma.objective.findMany({
            where,
            include: {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        firstName: true,
                        lastName: true,
                        jobTitle: true,
                        department: true
                    }
                }
            },
            orderBy: {
                dueDate: 'asc'
            }
        });
    }

    // Actualizar objetivo
    static async updateObjective(id: string, data: UpdateObjectiveData) {
        const updateData: any = { ...data };

        if (data.targetValue !== undefined) {
            updateData.targetValue = data.targetValue !== null ? new Decimal(data.targetValue) : null;
        }
        if (data.actualValue !== undefined) {
            updateData.actualValue = data.actualValue !== null ? new Decimal(data.actualValue) : null;
        }
        if (data.weight !== undefined) {
            updateData.weight = new Decimal(data.weight);
        }
        if (data.achievementScore !== undefined) {
            updateData.achievementScore = data.achievementScore !== null ? new Decimal(data.achievementScore) : null;
        }

        // Si se marca como completado, actualizar fecha
        if (data.status === 'COMPLETED' && !data.completedAt) {
            updateData.completedAt = new Date();
            updateData.progress = 100;
        }

        return prisma.objective.update({
            where: { id },
            data: updateData,
            include: {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });
    }

    // Actualizar progreso
    static async updateProgress(id: string, progress: number, actualValue?: number) {
        const updateData: any = {
            progress: Math.min(100, Math.max(0, progress))
        };

        if (actualValue !== undefined) {
            updateData.actualValue = new Decimal(actualValue);
        }

        // Auto-determinar estado basado en progreso
        if (progress >= 100) {
            updateData.status = 'COMPLETED';
            updateData.completedAt = new Date();
        } else if (progress > 0) {
            updateData.status = 'IN_PROGRESS';
        }

        return prisma.objective.update({
            where: { id },
            data: updateData
        });
    }

    // Eliminar objetivo
    static async deleteObjective(id: string) {
        return prisma.objective.delete({
            where: { id }
        });
    }

    // Crear objetivos en cascada (para equipos)
    static async createCascadeObjective(data: CreateObjectiveData & { cascadeToSubordinates: boolean }) {
        // Crear objetivo principal
        const mainObjective = await this.createObjective(data);

        if (data.cascadeToSubordinates) {
            // Obtener subordinados
            const subordinates = await prisma.employee.findMany({
                where: {
                    managerId: data.employeeId
                },
                select: { id: true }
            });

            // Crear objetivos para cada subordinado
            for (const subordinate of subordinates) {
                await this.createObjective({
                    ...data,
                    employeeId: subordinate.id,
                    parentObjectiveId: mainObjective.id
                });
            }
        }

        return mainObjective;
    }

    // Obtener estadísticas de objetivos
    static async getObjectiveStats(employeeId?: string) {
        const where: any = {};
        if (employeeId) where.employeeId = employeeId;

        const [total, byStatus, byCategory, avgProgress] = await Promise.all([
            prisma.objective.count({ where }),
            prisma.objective.groupBy({
                by: ['status'],
                where,
                _count: true
            }),
            prisma.objective.groupBy({
                by: ['category'],
                where,
                _count: true,
                _avg: {
                    progress: true
                }
            }),
            prisma.objective.aggregate({
                where,
                _avg: {
                    progress: true
                }
            })
        ]);

        return {
            total,
            byStatus: byStatus.reduce((acc, item) => {
                acc[item.status] = item._count;
                return acc;
            }, {} as Record<string, number>),
            byCategory: byCategory.reduce((acc, item) => {
                acc[item.category] = {
                    count: item._count,
                    avgProgress: item._avg.progress || 0
                };
                return acc;
            }, {} as Record<string, { count: number; avgProgress: number }>),
            averageProgress: avgProgress._avg.progress || 0
        };
    }

    // Obtener objetivos vencidos
    static async getOverdueObjectives() {
        return prisma.objective.findMany({
            where: {
                dueDate: { lt: new Date() },
                status: { notIn: ['COMPLETED', 'CANCELLED'] }
            },
            include: {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        manager: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                }
            }
        });
    }
}