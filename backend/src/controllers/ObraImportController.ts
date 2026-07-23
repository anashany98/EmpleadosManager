import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { AuditService } from '../services/AuditService';
import { AuthenticatedRequest } from '../types/express';
import { AppError } from '../utils/AppError';
import { ExcelParser } from '../services/ExcelParser';
import { StorageService } from '../services/StorageService';
import { ObraImportService } from '../services/ObraImportService';
import { CacheService } from '../services/CacheService';
import { PrestoParser } from '../services/PrestoParser';
import { validateUpload } from '../config/multer';
import * as ExcelJS from 'exceljs';
import { OBRA_EXPENSE_TYPES, type ObraImportWarning } from '../../../shared/obras';
import { createLogger } from '../services/LoggerService';

const logger = createLogger('ObraImportImport');

function ctx(req: Request) {
    return {
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
    };
}

interface ImportRowValid {
    rowIndex: number;
    raw: Record<string, any>;
    warnings: string[];
    data?: {
        obraId: string;
        employeeId: string | null;
        type: string;
        date: Date;
        amount: number;
        currency: string;
        description: string | null;
        vendor: string | null;
        reference: string | null;
        origin: string | null;
        destination: string | null;
    };
}

interface ImportRowInvalid {
    rowIndex: number;
    raw: Record<string, any>;
    warnings: string[];
    obraCode?: string | null;
    employeeDni?: string | null;
    originalRef?: string | null;
}

interface CachedValidation {
    totalRows: number;
    valid: ImportRowValid[];
    invalid: ImportRowInvalid[];
    raw: Record<string, any>[];
}

export const ObraImportController = {
    upload: async (req: Request, res: Response) => {
        try {
            if (!req.file) return ApiResponse.error(res, 'No se ha subido ningún archivo', 400);
            const userId = (req as AuthenticatedRequest).user?.id;
            if (!userId) throw new AppError('Usuario no autenticado', 401);
            const obraOverride = (req as AuthenticatedRequest).obraOverride || null;

            const buffer = req.file.buffer;

            // C3: Validate magic bytes (Excel signature) before processing
            validateUpload(req.file);

            const headers = await ExcelParser.getHeaders(buffer);

            let detectedLayout: 'presto' | 'flat' | 'unknown' = 'flat';
            let prestoHints: ReturnType<typeof PrestoParser.buildMappingHints> | null = null;
            let prestoPedidos: ReturnType<typeof PrestoParser.detectAndParse>['pedidos'] = [];
            try {
                const wb = new ExcelJS.Workbook();
                await wb.xlsx.load(buffer as any);
                const sheet = wb.worksheets[0];
                if (sheet) {
                    const det = PrestoParser.detectAndParse(sheet);
                    if (det.isPresto) {
                        detectedLayout = 'presto';
                        prestoHints = PrestoParser.buildMappingHints(headers);
                        prestoPedidos = det.pedidos;
                    }
                }
            } catch (err: unknown) {
                // C5: Log parse failure instead of silently swallowing
                logger.warn({ error: err instanceof Error ? err.message : String(err) }, '[ObraImport] Presto detection failed, falling back to flat');
            }

            const batch = await prisma.obraImportBatch.create({
                data: {
                    sourceFilename: req.file.originalname,
                    createdById: userId,
                    status: 'UPLOADED'
                }
            });

            const { key } = await StorageService.saveBuffer({
                folder: `obras/imports/${batch.id}`,
                originalName: req.file.originalname,
                buffer,
                contentType: req.file.mimetype
            });

            await prisma.obraImportBatch.update({
                where: { id: batch.id },
                data: { sourceFileUrl: key }
            });

            await AuditService.logWithContext('UPLOAD', 'OBRA_IMPORT_BATCH', batch.id, {
                userId,
                ...ctx(req),
                metadata: { filename: req.file.originalname, fileSize: req.file.size, detectedLayout }
            });

            return ApiResponse.success(res, {
                batchId: batch.id,
                headers,
                filename: key,
                detectedLayout,
                prestoHints,
                prestoPedidosCount: prestoPedidos.length
            }, 'Archivo subido. Configura el mapeo.', 201);
        } catch (err: unknown) {
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al subir el archivo', 500);
        }
    },

    preview: async (req: Request, res: Response) => {
        try {
            const userId = (req as AuthenticatedRequest).user?.id;
            if (!userId) throw new AppError('Usuario no autenticado', 401);
            const { id } = req.params;
            const rules = req.body?.mappingRules || req.body?.rules || {};
            const obraOverride: string | null = (req.body?.obraOverride && String(req.body.obraOverride).trim()) || null;

            const batch = await prisma.obraImportBatch.findUnique({ where: { id } });
            if (!batch) return ApiResponse.error(res, 'Lote no encontrado', 404);
            if (!batch.sourceFileUrl) return ApiResponse.error(res, 'El archivo ya no está disponible', 404);
            if (batch.status === 'COMMITTED') return ApiResponse.error(res, 'El lote ya fue confirmado', 409);

            // Cap de filas para evitar DoS por archivos grandes. Si lo supera, error
            // claro: el cliente puede partir el archivo o contactar a admin.
            const MAX_ROWS = 5000;
            const buffer = await StorageService.getBuffer(batch.sourceFileUrl);

            let isPresto = false;
            const prestoPedidos: ReturnType<typeof PrestoParser.detectAndParse>['pedidos'] = [];
            try {
                const wb = new ExcelJS.Workbook();
                await wb.xlsx.load(buffer as any);
                const sheet = wb.worksheets[0];
                if (sheet) {
                    const det = PrestoParser.detectAndParse(sheet);
                    if (det.isPresto) {
                        isPresto = true;
                        prestoPedidos.push(...det.pedidos);
                    }
                }
            } catch (err: unknown) {
                logger.warn({ error: err instanceof Error ? err.message : String(err) }, '[ObraImport] Presto detection failed in preview, falling back to flat');
            }

            let valid: ImportRowValid[] = [];
            let invalid: ImportRowInvalid[] = [];
            let totalRows = 0;

            if (isPresto) {
                const mapped = PrestoParser.toMappedRows(prestoPedidos, { overrideObraCode: obraOverride || null });
                if (mapped.length > MAX_ROWS) {
                    return ApiResponse.error(res, `El archivo tiene ${mapped.length} filas Presto, supera el máximo de ${MAX_ROWS}. Divide el archivo o contacta con admin.`, 413);
                }
                totalRows = mapped.length;

                // C1: Pre-load obras in one query instead of N
                const obraCodes = [...new Set(mapped.map(r => r.obra_code).filter(Boolean))];
                const obras = obraCodes.length
                    ? await prisma.project.findMany({ where: { code: { in: obraCodes } }, select: { id: true, code: true, status: true } })
                    : [];
                const obraByCode = new Map(obras.map(o => [o.code, o]));

                for (const row of mapped) {
                    const warnings: string[] = [];
                    if (!row.obra_code) warnings.push('MISSING_OBRA_CODE');
                    if (!row.date || isNaN(row.date.getTime())) warnings.push('INVALID_DATE');
                    if (!row.amount || row.amount <= 0) warnings.push('INVALID_AMOUNT');
                    if (!row.type || !(OBRA_EXPENSE_TYPES as readonly string[]).includes(row.type)) warnings.push('INVALID_TYPE');

                    const obra = row.obra_code ? obraByCode.get(row.obra_code) || null : null;
                    if (!obra) warnings.push('OBRA_NOT_FOUND');
                    else if (obra.status !== 'ACTIVE') warnings.push('OBRA_INACTIVE');

                    if (warnings.length > 0) {
                        invalid.push({ rowIndex: row.rowIndex, raw: row, warnings, obraCode: row.obra_code, employeeDni: null });
                    } else {
                        valid.push({
                            rowIndex: row.rowIndex,
                            raw: row,
                            warnings: [],
                            data: {
                                obraId: obra!.id,
                                employeeId: null,
                                type: row.type,
                                date: row.date,
                                amount: row.amount,
                                currency: row.currency || 'EUR',
                                description: row.description,
                                vendor: row.vendor,
                                reference: row.reference,
                                origin: null,
                                destination: null
                            }
                        });
                    }
                }
            } else {
                const raw = await ExcelParser.parseBuffer(buffer);
                if (raw.length > MAX_ROWS) {
                    return ApiResponse.error(res, `El archivo tiene ${raw.length} filas, supera el máximo de ${MAX_ROWS}. Divide el archivo o contacta con admin.`, 413);
                }
                const validation = await ObraImportService.validate(raw, rules);
                valid = validation.valid;
                invalid = validation.invalid;
                totalRows = raw.length;
            }

            // Cache del resultado de validación (30 min) — el commit lo reusa y
            // evita re-leer/re-parsear el Excel. TTL corto porque el archivo puede
            // cambiar; si se supera, el commit re-parsea (fallback robusto).
            const cached: CachedValidation = {
                totalRows,
                valid,
                invalid,
                raw: [] as Record<string, any>[]
            };
            CacheService.set(`obra-import:validation:${id}`, cached, 1800);

            await prisma.obraImportBatch.update({
                where: { id },
                data: {
                    mappingRules: JSON.stringify(rules),
                    status: 'MAPPED',
                    resultSummary: JSON.stringify({
                        totalRows,
                        validCount: valid.length,
                        invalidCount: invalid.length,
                        warningsByReason: invalid.reduce((acc: Record<string, number>, w) => {
                            for (const reason of w.warnings) acc[reason] = (acc[reason] || 0) + 1;
                            return acc;
                        }, {})
                    }),
                    warnings: JSON.stringify(invalid)
                }
            });

            await AuditService.logWithContext('PREVIEW_MAPPING', 'OBRA_IMPORT_BATCH', id, {
                userId,
                ...ctx(req),
                metadata: {
                    totalRows,
                    valid: valid.length,
                    invalid: invalid.length,
                    layout: isPresto ? 'presto' : 'flat'
                }
            });

            // Devolvemos solo muestras (10 valid, 25 invalid) para no inflar la response.
            // El commit obtiene el resultado completo desde CacheService.
            return ApiResponse.success(res, {
                batchId: id,
                totalRows,
                detectedLayout: isPresto ? 'presto' : 'flat',
                valid: valid.slice(0, 10),
                validCount: valid.length,
                invalid: invalid.slice(0, 25),
                invalidCount: invalid.length
            });
        } catch (err: unknown) {
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al previsualizar', 500);
        }
    },

    commit: async (req: Request, res: Response) => {
        try {
            const userId = (req as AuthenticatedRequest).user?.id;
            if (!userId) throw new AppError('Usuario no autenticado', 401);
            const { id } = req.params;
            const rules = req.body?.mappingRules || req.body?.rules || {};
            const obraOverride: string | null = (req.body?.obraOverride && String(req.body.obraOverride).trim()) || (req as AuthenticatedRequest).obraOverride || null;

            const batch = await prisma.obraImportBatch.findUnique({ where: { id } });
            if (!batch) return ApiResponse.error(res, 'Lote no encontrado', 404);
            if (batch.status === 'COMMITTED') return ApiResponse.error(res, 'El lote ya fue confirmado', 409);
            if (!batch.sourceFileUrl) return ApiResponse.error(res, 'El archivo ya no está disponible', 404);

            // 1) Reutilizar la validación cacheada por `preview` si está disponible
            //    (TTL 30 min). Evita re-leer el Excel y re-parsearlo. Si expiró
            //    o no existe (e.g. nunca se llamó preview), parseamos ahora.
            const cachedValidation = CacheService.get<CachedValidation>(`obra-import:validation:${id}`);
            let validRows: ImportRowValid[] = [];
            let invalidRows: ImportRowInvalid[] = [];

            if (cachedValidation) {
                validRows = cachedValidation.valid;
                invalidRows = cachedValidation.invalid;
                logger.info({ batchId: id, valid: validRows.length, invalid: invalidRows.length }, '[ObraImport] commit using cached validation');
            } else {
                const buffer = await StorageService.getBuffer(batch.sourceFileUrl);
                let isPresto = false;
                const prestoPedidos: ReturnType<typeof PrestoParser.detectAndParse>['pedidos'] = [];
                try {
                    const wb = new ExcelJS.Workbook();
                    await wb.xlsx.load(buffer as any);
                    const sheet = wb.worksheets[0];
                    if (sheet) {
                        const det = PrestoParser.detectAndParse(sheet);
                        if (det.isPresto) {
                            isPresto = true;
                            prestoPedidos.push(...det.pedidos);
                        }
                    }
                } catch (err: unknown) {
                    logger.warn({ error: err instanceof Error ? err.message : String(err) }, '[ObraImport] Presto detection failed in commit, falling back to flat');
                }

                if (isPresto) {
                    const mapped = PrestoParser.toMappedRows(prestoPedidos, { overrideObraCode: obraOverride || null });
                    const obraCodes = [...new Set(mapped.map(r => r.obra_code).filter(Boolean))];
                    const obras = obraCodes.length
                        ? await prisma.project.findMany({ where: { code: { in: obraCodes } }, select: { id: true, code: true, status: true } })
                        : [];
                    const obraByCode = new Map(obras.map(o => [o.code, o]));

                    for (const row of mapped) {
                        const warnings: string[] = [];
                        if (!row.obra_code) warnings.push('MISSING_OBRA_CODE');
                        if (!row.date || isNaN(row.date.getTime())) warnings.push('INVALID_DATE');
                        if (!row.amount || row.amount <= 0) warnings.push('INVALID_AMOUNT');
                        if (!row.type || !(OBRA_EXPENSE_TYPES as readonly string[]).includes(row.type)) warnings.push('INVALID_TYPE');
                        const obra = row.obra_code ? obraByCode.get(row.obra_code) || null : null;
                        if (!obra) warnings.push('OBRA_NOT_FOUND');
                        else if (obra.status !== 'ACTIVE') warnings.push('OBRA_INACTIVE');
                        if (warnings.length > 0) {
                            invalidRows.push({ rowIndex: row.rowIndex, raw: row, warnings, obraCode: row.obra_code, employeeDni: null, originalRef: row.originalRef });
                        } else {
                            validRows.push({
                                rowIndex: row.rowIndex,
                                raw: row,
                                warnings: [],
                                data: {
                                    obraId: obra!.id,
                                    employeeId: null,
                                    type: row.type,
                                    date: row.date,
                                    amount: row.amount,
                                    currency: row.currency || 'EUR',
                                    description: row.description,
                                    vendor: row.vendor,
                                    reference: row.reference,
                                    origin: null,
                                    destination: null
                                }
                            });
                        }
                    }
                } else {
                    const raw = await ExcelParser.parseBuffer(buffer);
                    const validation = await ObraImportService.validate(raw, rules);
                    validRows = validation.valid;
                    invalidRows = validation.invalid;
                }
            }

            if (validRows.length === 0) {
                return ApiResponse.error(res, 'No hay filas válidas para importar. Revisa el archivo y el mapeo.', 400);
            }

            const obraIds = Array.from(new Set(validRows.map((v) => v.data!.obraId)));
            const existingObras = obraIds.length
                ? await prisma.project.findMany({
                    where: { id: { in: obraIds } },
                    select: { id: true, status: true }
                })
                : [];
            const activeSet = new Set(existingObras.filter((o) => o.status === 'ACTIVE').map((o) => o.id));

            const finalValid: ImportRowValid[] = [];
            const finalInvalid = [...invalidRows];
            for (const v of validRows) {
                if (!activeSet.has(v.data!.obraId)) {
                    finalInvalid.push({
                        rowIndex: v.rowIndex,
                        raw: v.raw,
                        warnings: ['OBRA_INACTIVE'],
                        obraCode: (rules.obra_code && v.raw?.[rules.obra_code]) ? String(v.raw[rules.obra_code]) : null
                    });
                } else {
                    finalValid.push(v);
                }
            }

            const seenRefs = new Set<string>();
            const dups: ImportRowInvalid[] = [];
            for (const v of finalValid) {
                if (!v.data!.reference) continue;
                const key = `${v.data!.obraId}::${v.data!.reference}`;
                if (seenRefs.has(key)) {
                    dups.push({ rowIndex: v.rowIndex, raw: v.raw, warnings: ['DUPLICATE_REFERENCE'] });
                } else {
                    seenRefs.add(key);
                }
            }
            const finalValidAfterDup = finalValid.filter((v) => !dups.some((d) => d.rowIndex === v.rowIndex));

            // C2: Cross-batch idempotency — check references already in the database
            const refsToCheck = finalValidAfterDup
                .filter(v => v.data!.reference)
                .map(v => ({ obraId: v.data!.obraId, reference: v.data!.reference as string }));
            let finalValidRows = finalValidAfterDup;
            if (refsToCheck.length > 0) {
                const existingExpenses = await prisma.obraExpense.findMany({
                    where: {
                        OR: refsToCheck.map(r => ({ obraId: r.obraId, reference: r.reference }))
                    },
                    select: { obraId: true, reference: true }
                });
                const existingSet = new Set(existingExpenses.map(e => `${e.obraId}::${e.reference}`));
                const crossBatchDups: ImportRowInvalid[] = [];
                finalValidRows = finalValidAfterDup.filter((v) => {
                    if (!v.data!.reference) return true;
                    const key = `${v.data!.obraId}::${v.data!.reference}`;
                    if (existingSet.has(key)) {
                        crossBatchDups.push({ rowIndex: v.rowIndex, raw: v.raw, warnings: ['DUPLICATE_REFERENCE'] });
                        return false;
                    }
                    return true;
                });
                dups.push(...crossBatchDups);
            }

            const allInvalid = [...finalInvalid, ...dups];

            const txResult = await prisma.$transaction(async (tx) => {
                // MED-010: la unicidad (obraId, reference) la
                // garantiza el índice único en BD. El check
                // previo en `existingSet` (línea ~393) es una
                // optimización best-effort que mejora la UX
                // (muestra "DUPLICATE_REFERENCE" en warnings),
                // pero NO puede ser la única defensa porque dos
                // commits concurrentes pueden ver el set vacío
                // a la vez. Aquí dejamos que PostgreSQL haga
                // el trabajo: `createMany` con
                // `skipDuplicates: true` traduce los P2002 en
                // filas omitidas sin abortar la transacción.
                // El `count` resultante es el número REAL de
                // filas insertadas, que puede ser menor que
                // `finalValidRows.length` si hubo una carrera.
                const createResult = await tx.obraExpense.createMany({
                    data: finalValidRows.map((v) => ({
                        obraId: v.data!.obraId,
                        employeeId: v.data!.employeeId,
                        type: v.data!.type,
                        date: v.data!.date,
                        amount: v.data!.amount,
                        currency: v.data!.currency || 'EUR',
                        description: v.data!.description,
                        vendor: v.data!.vendor,
                        reference: v.data!.reference,
                        origin: v.data!.origin,
                        destination: v.data!.destination,
                        status: 'APPROVED',
                        importBatchId: id,
                        createdById: userId
                    })),
                    skipDuplicates: true
                });
                const txCount = createResult.count;
                await tx.obraImportBatch.update({
                    where: { id },
                    data: {
                        mappingRules: JSON.stringify(rules),
                        warnings: JSON.stringify(allInvalid),
                        status: 'COMMITTED',
                        resultSummary: JSON.stringify({
                            totalRows: validRows.length + allInvalid.length,
                            inserted: txCount,
                            warnings: allInvalid.length,
                            warningsByReason: allInvalid.reduce((acc: Record<string, number>, w) => {
                                for (const reason of w.warnings) acc[reason] = (acc[reason] || 0) + 1;
                                return acc;
                            }, {})
                        })
                    }
                });

                return txCount;
            });

            await AuditService.logWithContext('COMMIT', 'OBRA_IMPORT_BATCH', id, {
                userId,
                ...ctx(req),
                metadata: {
                    inserted: txResult,
                    warnings: allInvalid.length,
                    duplications: dups.length
                }
            });

            CacheService.invalidateByPrefix('report:obra-summary:');
            CacheService.invalidateByPrefix('report:obra-employee:');
            // Limpiar la cache de validación — ya no la necesitamos tras commitear
            CacheService.invalidateByPrefix(`obra-import:validation:${id}`);

            return ApiResponse.success(res, {
                batchId: id,
                inserted: txResult,
                warningsCount: allInvalid.length,
                warnings: allInvalid.slice(0, 25)
            }, 'Importación completada');
        } catch (err: unknown) {
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al confirmar la importación', 500);
        }
    },

    list: async (req: Request, res: Response) => {
        try {
            const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
            const batches = await prisma.obraImportBatch.findMany({
                orderBy: { createdAt: 'desc' },
                take: limit,
                include: {
                    createdBy: { select: { id: true, email: true } },
                    _count: { select: { expenses: true } }
                }
            });
            return ApiResponse.success(res, batches);
        } catch (err: unknown) {
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al listar lotes', 500);
        }
    },

    getById: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const batch = await prisma.obraImportBatch.findUnique({
                where: { id },
                include: {
                    createdBy: { select: { id: true, email: true } },
                    expenses: { take: 50, orderBy: { createdAt: 'desc' } },
                    obra: { select: { id: true, code: true, name: true } }
                }
            });
            if (!batch) return ApiResponse.error(res, 'Lote no encontrado', 404);
            return ApiResponse.success(res, batch);
        } catch (err: unknown) {
            return ApiResponse.error(res, err instanceof Error ? err.message : 'Error al obtener el lote', 500);
        }
    }
};
