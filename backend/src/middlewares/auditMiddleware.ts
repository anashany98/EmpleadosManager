import { type Request, type Response, type NextFunction } from 'express';
import { AuditService, AuditAction, AuditEntity } from '../services/AuditService';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';

const logger = createLogger('AuditMiddleware');

export interface AuditOptions {
    entity?: AuditEntity;
    actionGetter?: (req: Request) => AuditAction;
    skipOn?: (req: Request) => boolean;
}

export function auditMiddleware(options: AuditOptions) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const startTime = Date.now();

        res.on('finish', async () => {
            try {
                if (options.skipOn && options.skipOn(req)) {
                    return;
                }

                if (res.statusCode >= 400) {
                    return;
                }

                const authenticatedReq = req as AuthenticatedRequest;
                const userId = authenticatedReq.user?.id;
                const ipAddress = req.ip || req.socket.remoteAddress;
                const userAgent = req.headers['user-agent'];

                const entity = options.entity || getEntityFromRoute(req.path);
                const action = options.actionGetter
                    ? options.actionGetter(req)
                    : getActionFromMethod(req.method);

                const metadata = {
                    method: req.method,
                    path: req.path,
                    query: req.query,
                    duration: Date.now() - startTime,
                    statusCode: res.statusCode
                };

                await AuditService.logWithContext(action, entity, userId || 'anonymous', {
                    userId,
                    ipAddress,
                    userAgent,
                    metadata
                });
            } catch (error) {
                logger.error({ error }, 'Audit middleware error');
            }
        });

        next();
    };
}

export function securityAuditMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
        next();
    };
}

function getEntityFromRoute(path: string): AuditEntity {
    if (path.includes('/employees')) return AuditEntity.EMPLOYEE;
    if (path.includes('/vacations')) return AuditEntity.VACATION;
    if (path.includes('/expenses')) return AuditEntity.EXPENSE;
    if (path.includes('/documents')) return AuditEntity.DOCUMENT;
    if (path.includes('/payroll')) return AuditEntity.PAYROLL;
    if (path.includes('/timeoffice')) return AuditEntity.TIMEOFFICE;
    if (path.includes('/auth')) return AuditEntity.USER;
    return AuditEntity.USER;
}

function getActionFromMethod(method: string): AuditAction {
    switch (method.toUpperCase()) {
        case 'POST':
            return AuditAction.DATA_CREATE;
        case 'PUT':
        case 'PATCH':
            return AuditAction.DATA_UPDATE;
        case 'DELETE':
            return AuditAction.DATA_DELETE;
        case 'GET':
            return AuditAction.DATA_EXPORT;
        default:
            return AuditAction.DATA_EXPORT;
    }
}

export const auditSecurityEvents = () => async (req: Request, res: Response, next: NextFunction) => {
        const authenticatedReq = req as AuthenticatedRequest;
        
        res.on('finish', async () => {
            if (res.statusCode === 401 || res.statusCode === 403) {
                const ipAddress = req.ip || req.socket.remoteAddress;
                const userAgent = req.headers['user-agent'];
                const userId = authenticatedReq.user?.id;

                if (res.statusCode === 401) {
                    await AuditService.logLoginFailed(
                        authenticatedReq.body?.identifier || 'unknown',
                        'Unauthorized access attempt',
                        ipAddress,
                        userAgent
                    );
                } else if (res.statusCode === 403) {
                    await AuditService.logAccessDenied(
                        userId || 'unknown',
                        req.path,
                        'Insufficient permissions',
                        ipAddress
                    );
                }
            }
        });

        next();
    };