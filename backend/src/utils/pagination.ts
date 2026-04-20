import { Request } from 'express';

export interface PaginationParams {
    page: number;
    limit: number;
    skip: number;
    isPaginationRequested: boolean;
}

export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface PaginatedResult<T> {
    data: T[];
    meta: PaginationMeta;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const MIN_LIMIT = 1;

/**
 * Extracts and validates pagination parameters from the request query string.
 * Supports `page` and `limit` query parameters.
 *
 * - If `page` is not provided, pagination is considered "not requested" and
 *   the full result set (up to MAX_LIMIT) is returned without skip.
 * - `limit` is clamped between MIN_LIMIT and MAX_LIMIT.
 */
export function getPaginationParams(req: Request): PaginationParams {
    const isPaginationRequested = req.query.page !== undefined;
    const page = Math.max(DEFAULT_PAGE, parseInt(req.query.page as string) || DEFAULT_PAGE);
    const rawLimit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;
    const limit = Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, rawLimit));
    const skip = (page - 1) * limit;

    return { page, limit, skip, isPaginationRequested };
}

/**
 * Builds a Prisma-compatible skip/take object based on pagination state.
 * If pagination was not requested, returns { take: MAX_LIMIT } to prevent
 * unbounded queries while still returning all results for small datasets.
 */
export function getPrismaPagination(params: PaginationParams): { skip?: number; take: number } {
    if (params.isPaginationRequested) {
        return { skip: params.skip, take: params.limit };
    }
    return { take: MAX_LIMIT };
}

/**
 * Builds the pagination metadata object for API responses.
 */
export function buildPaginationMeta(total: number, params: PaginationParams): PaginationMeta {
    return {
        total,
        page: params.page,
        limit: params.isPaginationRequested ? params.limit : MAX_LIMIT,
        totalPages: Math.ceil(total / (params.isPaginationRequested ? params.limit : MAX_LIMIT))
    };
}
