import { prisma } from '../lib/prisma';

interface CreatePDIData {
    employeeId: string;
    evaluationId?: string;
    startDate: Date;
    endDate?: Date;
    goals?: any[];
    skills?: any[];
    training?: any[];
    mentoring?: any;
}

interface UpdatePDIData {
    goals?: any[];
    skills?: any[];
    training?: any[];
    mentoring?: any;
    status?: string;
    progress?: number;
    managerComments?: string;
    employeeComments?: string;
}

export class PDIService {
    // Crear PDI
    static async createPDI(data: CreatePDIData) {
        return prisma.pDI.create({
            data: {
                employeeId: data.employeeId,
                evaluationId: data.evaluationId,
                startDate: data.startDate,
                endDate: data.endDate,
                goals: data.goals || [],
                skills: data.skills || [],
                training: data.training || [],
                mentoring: data.mentoring,
                status: 'DRAFT'
            },
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
            }
        });
    }

    // Obtener PDI por ID
    static async getPDIById(id: string) {
        return prisma.pDI.findUnique({
            where: { id },
            include: {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        firstName: true,
                        lastName: true,
                        jobTitle: true,
                        department: true,
                        manager: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                },
                evaluation: {
                    include: {
                        template: {
                            select: {
                                name: true,
                                type: true
                            }
                        }
                    }
                }
            }
        });
    }

    // Listar PDIs
    static async listPDIs(filters: {
        employeeId?: string;
        status?: string;
    }) {
        const where: any = {};

        if (filters.employeeId) where.employeeId = filters.employeeId;
        if (filters.status) where.status = filters.status;

        return prisma.pDI.findMany({
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
                createdAt: 'desc'
            }
        });
    }

    // Actualizar PDI
    static async updatePDI(id: string, data: UpdatePDIData) {
        const updateData: any = { ...data };

        // Calcular progreso automáticamente si se actualizan goals o skills
        if (data.goals || data.skills) {
            const currentPDI = await prisma.pDI.findUnique({
                where: { id }
            });

            if (currentPDI) {
                const goals = data.goals || (currentPDI.goals as any[]);
                const skills = data.skills || (currentPDI.skills as any[]);

                let totalItems = 0;
                let completedItems = 0;

                goals.forEach((goal: any) => {
                    totalItems++;
                    if (goal.status === 'COMPLETED') completedItems++;
                });

                skills.forEach((skill: any) => {
                    totalItems++;
                    if (skill.status === 'COMPLETED') completedItems++;
                });

                if (totalItems > 0) {
                    updateData.progress = Math.round((completedItems / totalItems) * 100);
                }
            }
        }

        return prisma.pDI.update({
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

    // Activar PDI
    static async activatePDI(id: string, approvedBy: string) {
        return prisma.pDI.update({
            where: { id },
            data: {
                status: 'ACTIVE',
                approvedBy,
                approvedAt: new Date()
            }
        });
    }

    // Completar PDI
    static async completePDI(id: string) {
        return prisma.pDI.update({
            where: { id },
            data: {
                status: 'COMPLETED',
                endDate: new Date(),
                progress: 100
            }
        });
    }

    // Obtener PDI activo de un empleado
    static async getActivePDI(employeeId: string) {
        return prisma.pDI.findFirst({
            where: {
                employeeId,
                status: 'ACTIVE'
            },
            include: {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        firstName: true,
                        lastName: true,
                        jobTitle: true
                    }
                }
            }
        });
    }

    // Obtener estadísticas de PDIs
    static async getPDIStats(employeeId?: string) {
        const where: any = {};
        if (employeeId) where.employeeId = employeeId;

        const [total, byStatus, avgProgress] = await Promise.all([
            prisma.pDI.count({ where }),
            prisma.pDI.groupBy({
                by: ['status'],
                where,
                _count: true
            }),
            prisma.pDI.aggregate({
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
            averageProgress: avgProgress._avg.progress || 0
        };
    }

    // Agregar entrenamiento al PDI
    static async addTraining(pdiId: string, training: {
        course: string;
        provider?: string;
        date?: Date;
        cost?: number;
    }) {
        const pdi = await prisma.pDI.findUnique({
            where: { id: pdiId }
        });

        if (!pdi) {
            throw new Error('PDI no encontrado');
        }

        const currentTraining = (pdi.training as any[]) || [];
        const newTraining = [
            ...currentTraining,
            {
                id: `training-${Date.now()}`,
                ...training,
                status: 'PENDING',
                createdAt: new Date()
            }
        ];

        return prisma.pDI.update({
            where: { id: pdiId },
            data: {
                training: newTraining
            }
        });
    }

    // Actualizar estado de entrenamiento
    static async updateTrainingStatus(pdiId: string, trainingId: string, status: string) {
        const pdi = await prisma.pDI.findUnique({
            where: { id: pdiId }
        });

        if (!pdi) {
            throw new Error('PDI no encontrado');
        }

        const training = (pdi.training as any[]) || [];
        const updatedTraining = training.map(t => 
            t.id === trainingId ? { ...t, status, updatedAt: new Date() } : t
        );

        return prisma.pDI.update({
            where: { id: pdiId },
            data: {
                training: updatedTraining
            }
        });
    }
}