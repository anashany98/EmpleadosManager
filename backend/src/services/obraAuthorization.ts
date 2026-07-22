import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import type { AuthUser } from '../types/express';

export const ObraAuthorization = {
    async ensureActive(id: string) {
        const obra = await prisma.project.findUnique({ where: { id }, select: { id: true, status: true } });
        if (!obra) throw new AppError('Obra no encontrada', 404);
        if (obra.status !== 'ACTIVE') {
            throw new AppError('La obra está cerrada. No se pueden añadir nuevos gastos.', 409);
        }
        return obra;
    },

    async ensureExists(id: string) {
        const obra = await prisma.project.findUnique({ where: { id }, select: { id: true, status: true } });
        if (!obra) throw new AppError('Obra no encontrada', 404);
        return obra;
    },

    /**
     * O2: Verify user can access the obra based on role scoping.
     * Admin and HR roles bypass checks. Managers can only access obras they manage.
     */
    async ensureCanAccess(id: string, user: AuthUser) {
        const obra = await prisma.project.findUnique({
            where: { id },
            select: { id: true, status: true, managerId: true }
        });
        if (!obra) throw new AppError('Obra no encontrada', 404);

        // Admin and HR can access all obras
        if (user.role === 'admin' || user.role === 'hr') {
            return obra;
        }

        // Managers can only access obras they are assigned to
        if (user.role === 'manager' && obra.managerId && obra.managerId !== user.employeeId) {
            throw new AppError('No tienes acceso a esta obra', 403);
        }

        return obra;
    }
};
