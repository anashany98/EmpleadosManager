import type { AuthUser } from '../types/express';

/**
 * Helpers de autorización por tenant — IMP-001.
 *
 * El proyecto ya tiene `shared/authz/index.ts` con policies
 * declarativas (`canAccessPolicy`). Este módulo añade utilidades
 * imperativas para los lugares donde aún se hace
 * `if (user.role === 'admin')` directamente en el controlador.
 *
 * Reglas (mismas que `canAccessPolicy`):
 *   - Admin global: user.role === 'admin' && !user.companyId
 *   - Admin de empresa: user.role === 'admin' && user.companyId
 *   - HR/Manager/Employee: requieren coincidencia de companyId
 *
 * Por qué NO basta con `isGlobalAdmin` ya existente:
 *   - Muchos controllers usaban `role==='admin'` pensando que
 *     "admin = superusuario", cuando en realidad "admin" significa
 *     "admin de SU empresa". Un admin de A podía ver datos de B.
 *   - Estos helpers dejan explícito el modelo: admin sin empresa
 *     es global; admin con empresa es de tenant.
 */

export interface TenantActor {
    id: string;
    role?: string;
    companyId?: string | null;
    employeeId?: string | null;
}

export function isGlobalAdmin(actor: TenantActor | null | undefined): boolean {
    return !!actor && actor.role === 'admin' && !actor.companyId;
}

/**
 * Devuelve el tenant del actor para usar en queries Prisma.
 *   - Admin global: `null` (no filtra, ve todo)
 *   - Admin de empresa: companyId del actor
 *   - Resto: companyId del actor (o `null` si no tiene)
 *
 * Si el actor no tiene companyId y NO es admin global,
 * devuelve `null` y el caller debe rechazar (no devolver
 * datos de cualquier tenant).
 */
export function getActorCompanyFilter(actor: TenantActor | null | undefined): string | null {
    if (!actor) return null;
    if (isGlobalAdmin(actor)) return null; // sin filtro
    return actor.companyId ?? null;
}

/**
 * Compara el tenant del actor con el tenant del recurso. Acepta
 * también `null` como tenant del recurso: si el recurso no
 * pertenece a ninguna empresa, SÓLO el admin global puede acceder.
 *
 * Usos típicos:
 *   - Antes de leer un Document: `if (!actorMatchesTenant(user, doc.employee.companyId)) return 404;`
 *   - Antes de listar: `const where = { ...(getActorCompanyFilter(user) ? { companyId: getActorCompanyFilter(user) } : {}) }`
 */
export function actorMatchesTenant(actor: TenantActor | null | undefined, targetCompanyId: string | null | undefined): boolean {
    if (!actor) return false;
    if (isGlobalAdmin(actor)) return true; // el admin global ve cualquier tenant (incluido null)
    if (!actor.companyId) return false;    // actor sin tenant no puede ver nada
    if (!targetCompanyId) return false;    // recurso huérfano: solo admin global
    return actor.companyId === targetCompanyId;
}

/**
 * Helper para los guards de controllers. Devuelve `true` si la
 * operación debe seguir. Si devuelve `false`, el caller debe
 * responder 404 (no 403, para no enumerar).
 *
 * Uso:
 *   if (!assertSameTenantOrGlobal(user, target.companyId)) {
 *       return ApiResponse.error(res, 'Recurso no encontrado', 404);
 *   }
 */
export function assertSameTenantOrGlobal(actor: TenantActor | null | undefined, targetCompanyId: string | null | undefined): boolean {
    return actorMatchesTenant(actor, targetCompanyId);
}
