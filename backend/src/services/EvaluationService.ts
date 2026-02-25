import { prisma } from '../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

// Types
interface CreateEvaluationData {
    templateId: string;
    employeeId: string;
    evaluatorId: string;
    periodStart: Date;
    periodEnd: Date;
    dueDate: Date;
}

interface UpdateEvaluationData {
    selfScores?: Record<string, number>;
    managerScores?: Record<string, number>;
    strengths?: string;
    improvements?: string;
    managerComments?: string;
    status?: string;
}

interface EvaluationWithDetails {
    id: string;
    template: {
        id: string;
        name: string;
        type: string;
        competencies: any;
        scaleConfig: any;
    };
    employee: {
        id: string;
        name: string;
        firstName: string | null;
        lastName: string | null;
        email: string | null;
        jobTitle: string | null;
        department: string | null;
    };
    evaluator: {
        id: string;
        name: string;
        firstName: string | null;
        lastName: string | null;
    };
    periodStart: Date;
    periodEnd: Date;
    dueDate: Date;
    status: string;
    selfScores: any;
    managerScores: any;
    peerScores: any;
    finalScore: Decimal | null;
    strengths: string | null;
    improvements: string | null;
    managerComments: string | null;
    selfSubmittedAt: Date | null;
    managerSubmittedAt: Date | null;
    acknowledgedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    peerReviews: any[];
    objectives: any[];
}

export class EvaluationService {
    // Crear una nueva evaluación
    static async createEvaluation(data: CreateEvaluationData) {
        // Verificar que el template existe
        const template = await prisma.evaluationTemplate.findUnique({
            where: { id: data.templateId }
        });

        if (!template) {
            throw new Error('Template no encontrado');
        }

        // Verificar que no existe ya una evaluación para el mismo período
        const existingEvaluation = await prisma.evaluation.findFirst({
            where: {
                employeeId: data.employeeId,
                templateId: data.templateId,
                periodStart: data.periodStart,
                periodEnd: data.periodEnd
            }
        });

        if (existingEvaluation) {
            throw new Error('Ya existe una evaluación para este período');
        }

        return prisma.evaluation.create({
            data: {
                templateId: data.templateId,
                employeeId: data.employeeId,
                evaluatorId: data.evaluatorId,
                periodStart: data.periodStart,
                periodEnd: data.periodEnd,
                dueDate: data.dueDate,
                status: 'DRAFT'
            },
            include: {
                template: true,
                employee: true,
                evaluator: true
            }
        });
    }

    // Obtener evaluación por ID
    static async getEvaluationById(id: string): Promise<EvaluationWithDetails | null> {
        return prisma.evaluation.findUnique({
            where: { id },
            include: {
                template: true,
                employee: true,
                evaluator: true,
                peerReviews: {
                    include: {
                        reviewer: {
                            select: {
                                id: true,
                                name: true,
                                firstName: true,
                                lastName: true
                            }
                        }
                    }
                },
                objectives: true
            }
        }) as Promise<EvaluationWithDetails | null>;
    }

    // Listar evaluaciones con filtros
    static async listEvaluations(filters: {
        employeeId?: string;
        evaluatorId?: string;
        status?: string;
        templateId?: string;
        periodStart?: Date;
        periodEnd?: Date;
    }) {
        const where: any = {};

        if (filters.employeeId) where.employeeId = filters.employeeId;
        if (filters.evaluatorId) where.evaluatorId = filters.evaluatorId;
        if (filters.status) where.status = filters.status;
        if (filters.templateId) where.templateId = filters.templateId;
        if (filters.periodStart) where.periodStart = { gte: filters.periodStart };
        if (filters.periodEnd) where.periodEnd = { lte: filters.periodEnd };

        return prisma.evaluation.findMany({
            where,
            include: {
                template: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                },
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
                evaluator: {
                    select: {
                        id: true,
                        name: true,
                        firstName: true,
                        lastName: true
                    }
                }
            },
            orderBy: {
                dueDate: 'asc'
            }
        });
    }

    // Actualizar evaluación
    static async updateEvaluation(id: string, data: UpdateEvaluationData) {
        const evaluation = await prisma.evaluation.findUnique({
            where: { id }
        });

        if (!evaluation) {
            throw new Error('Evaluación no encontrada');
        }

        const updateData: any = { ...data };

        // Si se envían selfScores, marcar como autoevaluación completada
        if (data.selfScores && evaluation.status === 'DRAFT') {
            updateData.status = 'SELF_IN_PROGRESS';
        }

        // Si se envían managerScores, calcular puntuación final
        if (data.managerScores) {
            const template = await prisma.evaluationTemplate.findUnique({
                where: { id: evaluation.templateId }
            });

            if (template) {
                const competencies = template.competencies as any[];
                let totalScore = 0;
                let totalWeight = 0;

                competencies.forEach(comp => {
                    const weight = comp.weight || 1;
                    const score = data.managerScores![comp.id] || 0;
                    totalScore += score * weight;
                    totalWeight += weight;
                });

                if (totalWeight > 0) {
                    updateData.finalScore = new Decimal(totalScore / totalWeight);
                }
            }
        }

        return prisma.evaluation.update({
            where: { id },
            data: updateData,
            include: {
                template: true,
                employee: true,
                evaluator: true
            }
        });
    }

    // Enviar autoevaluación
    static async submitSelfEvaluation(id: string, selfScores: Record<string, number>, strengths?: string, improvements?: string) {
        const evaluation = await prisma.evaluation.findUnique({
            where: { id }
        });

        if (!evaluation) {
            throw new Error('Evaluación no encontrada');
        }

        return prisma.evaluation.update({
            where: { id },
            data: {
                selfScores: selfScores as any,
                strengths,
                improvements,
                selfSubmittedAt: new Date(),
                status: 'MANAGER_IN_PROGRESS'
            }
        });
    }

    // Enviar evaluación del manager
    static async submitManagerEvaluation(id: string, managerScores: Record<string, number>, managerComments?: string) {
        const evaluation = await prisma.evaluation.findUnique({
            where: { id },
            include: { template: true }
        });

        if (!evaluation) {
            throw new Error('Evaluación no encontrada');
        }

        // Calcular puntuación final
        const competencies = (evaluation.template as any).competencies as any[];
        let totalScore = 0;
        let totalWeight = 0;

        competencies.forEach(comp => {
            const weight = comp.weight || 1;
            const score = managerScores[comp.id] || 0;
            totalScore += score * weight;
            totalWeight += weight;
        });

        const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;

        return prisma.evaluation.update({
            where: { id },
            data: {
                managerScores: managerScores as any,
                managerComments,
                finalScore: new Decimal(finalScore),
                managerSubmittedAt: new Date(),
                status: 'COMPLETED'
            }
        });
    }

    // Confirmar evaluación por el empleado
    static async acknowledgeEvaluation(id: string) {
        return prisma.evaluation.update({
            where: { id },
            data: {
                acknowledgedAt: new Date(),
                status: 'ACKNOWLEDGED'
            }
        });
    }

    // Crear evaluaciones masivas
    static async createBulkEvaluations(data: {
        templateId: string;
        employeeIds: string[];
        periodStart: Date;
        periodEnd: Date;
        dueDate: Date;
    }) {
        // Obtener managers de los empleados
        const employees = await prisma.employee.findMany({
            where: {
                id: { in: data.employeeIds }
            },
            select: {
                id: true,
                managerId: true
            }
        });

        const evaluations = [];

        for (const employee of employees) {
            if (!employee.managerId) continue;

            try {
                const evaluation = await this.createEvaluation({
                    templateId: data.templateId,
                    employeeId: employee.id,
                    evaluatorId: employee.managerId,
                    periodStart: data.periodStart,
                    periodEnd: data.periodEnd,
                    dueDate: data.dueDate
                });
                evaluations.push(evaluation);
            } catch (error) {
                console.error(`Error creating evaluation for employee ${employee.id}:`, error);
            }
        }

        return evaluations;
    }

    // Obtener estadísticas de evaluaciones
    static async getEvaluationStats(filters?: {
        department?: string;
        periodStart?: Date;
        periodEnd?: Date;
    }) {
        const where: any = {};

        if (filters?.periodStart) where.periodStart = { gte: filters.periodStart };
        if (filters?.periodEnd) where.periodEnd = { lte: filters.periodEnd };

        if (filters?.department) {
            where.employee = {
                department: filters.department
            };
        }

        const [total, byStatus, avgScore] = await Promise.all([
            prisma.evaluation.count({ where }),
            prisma.evaluation.groupBy({
                by: ['status'],
                where,
                _count: true
            }),
            prisma.evaluation.aggregate({
                where: {
                    ...where,
                    finalScore: { not: null }
                },
                _avg: {
                    finalScore: true
                }
            })
        ]);

        return {
            total,
            byStatus: byStatus.reduce((acc, item) => {
                acc[item.status] = item._count;
                return acc;
            }, {} as Record<string, number>),
            averageScore: avgScore._avg.finalScore || 0
        };
    }
}