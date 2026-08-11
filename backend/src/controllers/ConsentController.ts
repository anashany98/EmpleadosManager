import { Request, Response } from 'express';
import { ConsentService, CONSENT_PURPOSES } from '../services/ConsentService';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../types/express';

function getRequesterIp(req: Request): string | undefined {
    // ALT-1: NO leer el header X-Forwarded-For crudo — la entrada de la
    // izquierda la puede inventar el cliente y falsearía la IP del audit
    // de consentimientos. Con `trust proxy = 1` (createApp.ts), Express
    // ya calcula `req.ip` correctamente a partir del proxy de confianza.
    return req.ip;
}

function getRequesterUserAgent(req: Request): string | undefined {
    const ua = req.headers['user-agent'];
    return typeof ua === 'string' ? ua.slice(0, 500) : undefined;
}

async function resolveEmployeeId(req: Request, requested?: string): Promise<string> {
    const { user } = req as AuthenticatedRequest;
    if (!user) throw new AppError('No autenticado', 401);

    // If the caller is the data subject themselves, they can only
    // manage their own consents. If they specify a different
    // employeeId, they must be a global admin.
    if (requested) {
        const isGlobalAdmin = !user.companyId && user.role === 'admin';
        if (!isGlobalAdmin) {
            throw new AppError('Solo administradores globales pueden registrar consentimientos en nombre de otros', 403);
        }
        return requested;
    }

    if (!user.employeeId) {
        throw new AppError('Tu usuario no está vinculado a un empleado', 400);
    }
    return user.employeeId;
}

export const ConsentController = {
    listPurposes: async (_req: Request, res: Response) => ApiResponse.success(res, Object.values(CONSENT_PURPOSES)),

    getMyConsents: async (req: Request, res: Response) => {
        const { user } = req as AuthenticatedRequest;
        if (!user?.employeeId) {
            return ApiResponse.error(res, 'Tu usuario no está vinculado a un empleado', 400);
        }
        const consents = await ConsentService.getConsentStatusByPurpose(user.employeeId);
        return ApiResponse.success(res, consents);
    },

    getForEmployee: async (req: Request, res: Response) => {
        const { employeeId } = req.params;
        const { user } = req as AuthenticatedRequest;
        if (!user) return ApiResponse.error(res, 'No autenticado', 401);

        // Self access always allowed. Cross-employee access only for
        // admins within the same company.
        if (user.employeeId !== employeeId) {
            const isGlobalAdmin = !user.companyId && user.role === 'admin';
            if (!isGlobalAdmin) {
                // Same-company managers can also view
                const target = await prisma.employee.findUnique({
                    where: { id: employeeId },
                    select: { companyId: true }
                });
                if (!target || (user.companyId && target.companyId !== user.companyId)) {
                    return ApiResponse.error(res, 'No autorizado', 403);
                }
            }
        }
        const consents = await ConsentService.listConsentsForEmployee(employeeId);
        return ApiResponse.success(res, consents);
    },

    grantOrWithdraw: async (req: Request, res: Response) => {
        const { purpose, granted, employeeId, policyVersion, notes } = req.body as {
            purpose: string;
            granted?: boolean;
            employeeId?: string;
            policyVersion?: string;
            notes?: string;
        };
        const { user } = req as AuthenticatedRequest;
        if (!user) return ApiResponse.error(res, 'No autenticado', 401);

        const targetEmployeeId = await resolveEmployeeId(req, employeeId);
        const consent = await ConsentService.recordConsent(
            targetEmployeeId,
            purpose,
            {
                granted: granted ?? true,
                ipAddress: getRequesterIp(req),
                userAgent: getRequesterUserAgent(req),
                policyVersion,
                notes
            },
            { id: user.id, role: user.role ?? 'employee' }
        );
        return ApiResponse.success(res, consent, granted === false ? 'Consentimiento retirado' : 'Consentimiento registrado', 201);
    },

    withdraw: async (req: Request, res: Response) => {
        // Convenience endpoint for the GDPR-mandated "as easy to
        // withdraw as to give". Functionally identical to POST /
        // with granted=false, but exposes the intent explicitly.
        req.body.granted = false;
        return ConsentController.grantOrWithdraw(req, res);
    },

    delete: async (req: Request, res: Response) => {
        // Hard-delete a consent record. Reserved for compliance use
        // cases (e.g. user proves the record was captured under a
        // different identity). Requires global admin.
        const { user } = req as AuthenticatedRequest;
        const isGlobalAdmin = !user?.companyId && user?.role === 'admin';
        if (!isGlobalAdmin) {
            return ApiResponse.error(res, 'Solo administradores globales pueden eliminar consentimientos', 403);
        }
        const { id } = req.params;
        await prisma.consent.delete({ where: { id } });
        return ApiResponse.success(res, null, 'Consentimiento eliminado', 204);
    }
};
