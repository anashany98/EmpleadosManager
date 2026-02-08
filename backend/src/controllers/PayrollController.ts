import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ExcelParser } from '../services/ExcelParser';
import { MappingService } from '../services/MappingService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuditService } from '../services/AuditService';
import { PayrollPdfService } from '../services/PayrollPdfService';
import { StorageService } from '../services/StorageService';
import { EncryptionService } from '../services/EncryptionService';
import { PayrollAutomationService } from '../services/PayrollAutomationService';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';

const log = createLogger('PayrollController');


export const PayrollController = {
    // 1. Subir archivo
    upload: async (req: Request, res: Response) => {
        try {
            if (!req.file) {
                return ApiResponse.error(res, 'No se ha subido ningún archivo', 400);
            }

            const userId = (req as AuthenticatedRequest).user?.id || 'system';

            // Leemos buffer para sacar headers de forma asíncrona
            const buffer = req.file.buffer;
            const headers = ExcelParser.getHeaders(buffer);

            // Crear el Batch
            const batch = await prisma.payrollImportBatch.create({
                data: {
                    year: new Date().getFullYear(),
                    month: new Date().getMonth() + 1,
                    sourceFilename: req.file.originalname,
                    createdById: userId,
                    status: 'UPLOADED'
                }
            });

            // Persist original file for mapping (S3/local)
            const { key } = await StorageService.saveBuffer({
                folder: `payroll/imports/${batch.id}`,
                originalName: req.file.originalname,
                buffer,
                contentType: req.file.mimetype
            });

            await prisma.payrollImportBatch.update({
                where: { id: batch.id },
                data: { sourceFileUrl: key }
            });

            await AuditService.log('UPLOAD', 'PAYROLL_BATCH', batch.id, { filename: req.file.originalname }, userId);

            return ApiResponse.success(res, {
                batchId: batch.id,
                headers,
                // legacy field kept for frontend compatibility
                filename: key,
            }, 'Archivo subido correctamente. Por favor configura el mapeo.');

        } catch (error: any) {
            log.error({ error }, 'Error processing payroll upload');
            return ApiResponse.error(res, error.message || 'Error al procesar el archivo Excel', 500);
        }
    },

    // 2. Aplicar Mapeo y generar rows
    applyMapping: async (req: Request, res: Response) => {
        const { id } = req.params; // Batch ID
        const { mappingRules, filename } = req.body; // Rules { "neto": "Importe Neto" } y el nombre físico temp
        const userId = (req as AuthenticatedRequest).user?.id || 'system';

        try {
            const batch = await prisma.payrollImportBatch.findUnique({ where: { id } });
            if (!batch) return ApiResponse.error(res, 'Lote no encontrado', 404);

            let buffer: Buffer | null = null;

            if (batch.sourceFileUrl) {
                buffer = await StorageService.getBuffer(batch.sourceFileUrl);
            } else if (filename) {
                // Legacy fallback: local temp file (pre-S3)
                const fs = await import('fs');
                const filePath = `uploads/${filename}`;
                try {
                    await fs.promises.access(filePath);
                    buffer = await fs.promises.readFile(filePath);
                } catch {
                    buffer = null;
                }
            }

            if (!buffer) {
                return ApiResponse.error(res, 'El archivo original ha caducado o no existe', 404);
            }

            const rawData = ExcelParser.parseBuffer(buffer);

            // Transformar
            const rowsData = MappingService.applyMapping(rawData, mappingRules, id);

            // Guardar en BD (Transactions)
            await prisma.$transaction([
                prisma.payrollRow.deleteMany({ where: { batchId: id } }),
                prisma.payrollRow.createMany({
                    data: rowsData as any
                }),
                prisma.payrollImportBatch.update({
                    where: { id },
                    data: { status: 'MAPPED' }
                })
            ]);

            await AuditService.log('APPLY_MAPPING', 'PAYROLL_BATCH', id, { rowCount: rowsData.length }, userId);

            return ApiResponse.success(res, { rowsCreated: rowsData.length }, 'Mapeo aplicado correctamente');

        } catch (error: any) {
            log.error({ error }, 'Error applying mapping');
            return ApiResponse.error(res, error.message || 'Error al aplicar el mapeo', 500);
        }
    },

    // Obtener últimos lotes (para Dashboard)
    getLatestBatches: async (req: Request, res: Response) => {
        try {
            const { limit = 5 } = req.query;
            const batches = await prisma.payrollImportBatch.findMany({
                take: Number(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: {
                        select: { rows: true }
                    },
                    createdBy: {
                        select: { email: true, role: true } // Audit info
                    }
                }
            });

            const formatted = batches.map(b => ({
                id: b.id,
                name: b.sourceFilename,
                date: b.createdAt,
                status: b.status,
                rows: b._count.rows,
                user: b.createdBy?.email || 'System'
            }));

            return ApiResponse.success(res, formatted);
        } catch (error: any) {
            log.error({ error }, 'Error fetching latest batches');
            return ApiResponse.error(res, 'Error al obtener lotes recientes', 500);
        }
    },

    // Obtener filas de un lote con paginación
    getRows: async (req: Request, res: Response) => {
        const { id } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = (page - 1) * limit;

        try {
            const [rows, total] = await prisma.$transaction([
                prisma.payrollRow.findMany({
                    where: { batchId: id },
                    skip,
                    take: limit,
                    include: { items: true }, // Include items in main fetch if needed, or separate
                    orderBy: { id: 'asc' }
                }),
                prisma.payrollRow.count({ where: { batchId: id } })
            ]);

            return ApiResponse.success(res, {
                rows,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            });
        } catch (error: any) {
            log.error({ error }, 'Error fetching rows');
            return ApiResponse.error(res, error.message || 'Error al obtener filas', 500);
        }
    },

    getBreakdown: async (req: Request, res: Response) => {
        const { rowId } = req.params;
        try {
            const items = await prisma.payrollItem.findMany({
                where: { payrollRowId: rowId },
                orderBy: { createdAt: 'asc' }
            });
            return ApiResponse.success(res, items);
        } catch (error: any) {
            return ApiResponse.error(res, 'Error al obtener desglose', 500);
        }
    },

    saveBreakdown: async (req: Request, res: Response) => {
        const { rowId } = req.params;
        const { items } = req.body; // Expects [{ concept, amount, type }]

        try {
            await prisma.$transaction([
                prisma.payrollItem.deleteMany({ where: { payrollRowId: rowId } }),
                prisma.payrollItem.createMany({
                    data: items.map((item: any) => ({
                        payrollRowId: rowId,
                        concept: item.concept,
                        amount: parseFloat(item.amount),
                        type: item.type
                    }))
                })
            ]);

            return ApiResponse.success(res, { message: 'Desglose actualizado correctamente' });
        } catch (error: any) {
            log.error({ error }, 'Save breakdown error');
            return ApiResponse.error(res, 'Error al guardar el desglose', 500);
        }
    },

    getEmployeePayrolls: async (req: Request, res: Response) => {
        const { employeeId } = req.params;
        try {
            const rows = await prisma.payrollRow.findMany({
                where: { employeeId },
                include: { batch: { select: { year: true, month: true } }, items: true },
                orderBy: { batch: { month: 'desc' } }
            });
            return ApiResponse.success(res, rows);
        } catch (error: any) {
            return ApiResponse.error(res, 'Error al obtener nóminas del empleado', 500);
        }
    },

    createManualPayroll: async (req: Request, res: Response) => {
        const { employeeId, year, month, bruto, neto } = req.body;
        const userId = (req as AuthenticatedRequest).user?.id || 'system';

        try {
            // 1. Find or create batch for Manual Entries for this Month/Year
            let batch = await prisma.payrollImportBatch.findFirst({
                where: { year, month, sourceFilename: 'ENTRADA_MANUAL' }
            });

            if (!batch) {
                batch = await prisma.payrollImportBatch.create({
                    data: {
                        year,
                        month,
                        sourceFilename: 'ENTRADA_MANUAL',
                        status: 'MAPPED',
                        createdById: userId
                    }
                });
            }

            // 2. Create Row
            const row = await prisma.payrollRow.create({
                data: {
                    batchId: batch.id,
                    employeeId,
                    bruto: parseFloat(bruto || 0),
                    neto: parseFloat(neto || 0),
                    status: 'VALID',
                    rawEmployeeName: 'Manual Entry'
                }
            });

            return ApiResponse.success(res, row, 'Nómina creada correctamente');
        } catch (error: any) {
            log.error({ error }, 'Error creating manual payroll');
            return ApiResponse.error(res, 'Error al crear nómina manual', 500);
        }
    },

    downloadPdf: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            const payroll = await prisma.payrollRow.findUnique({
                where: { id },
                include: {
                    batch: true,
                    employee: {
                        include: { company: true }
                    },
                    items: true
                }
            });

            if (!payroll) return ApiResponse.error(res, 'Nómina no encontrada', 404);
            if (!payroll.employee) return ApiResponse.error(res, 'Empleado no asociado a la nómina', 400);

            // Security Check
            const { user } = req as AuthenticatedRequest;
            if (user.role !== 'admin' && (!user.employeeId || user.employeeId !== payroll.employeeId)) {
                return ApiResponse.error(res, 'No tiene permiso para descargar esta nómina', 403);
            }

            // Default company if missing
            const companyData = payroll.employee.company;

            const pdfBuffer = await PayrollPdfService.generate(res, {
                id: payroll.id,
                month: payroll.batch.month,
                year: payroll.batch.year,
                bruto: Number(payroll.bruto),
                neto: Number(payroll.neto),
                ssEmpresa: Number(payroll.ssEmpresa),
                ssTrabajador: Number(payroll.ssTrabajador),
                irpf: Number(payroll.irpf),
                company: {
                    name: companyData?.name || 'Empresa Genérica S.L.',
                    cif: companyData?.cif || 'B00000000',
                    address: (companyData as any)?.address || 'Calle Sin Dirección',
                    city: (companyData as any)?.city || 'Madrid',
                    postalCode: (companyData as any)?.postalCode || '28000'
                },
                employee: {
                    name: payroll.employee.name,
                    dni: payroll.employee.dni,
                    socialSecurityNumber: EncryptionService.decrypt(payroll.employee.socialSecurityNumber) || '',
                    jobTitle: payroll.employee.jobTitle || 'Empleado',
                    category: payroll.employee.category || undefined,
                    seniorityDate: payroll.employee.entryDate || undefined
                },
                items: payroll.items.map(i => ({
                    concept: i.concept,
                    amount: Number(i.amount),
                    type: i.type as 'EARNING' | 'DEDUCTION'
                }))
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=Nomina_${payroll.batch.month}_${payroll.batch.year}_${payroll.employee.dni}.pdf`);
            res.send(pdfBuffer);

        } catch (error: any) {
            log.error({ error }, 'PDF Generation Error');
            return ApiResponse.error(res, 'Error al generar el PDF', 500);
        }
    },

    generateFromKiosk: async (req: Request, res: Response) => {
        const { year, month, companyId } = req.body;
        const userId = (req as AuthenticatedRequest).user?.id || 'system';

        if (!year || !month || !companyId) {
            return ApiResponse.error(res, 'Año, mes y empresa son obligatorios', 400);
        }

        try {
            const batch = await PayrollAutomationService.generateFromAttendance(
                Number(year),
                Number(month),
                companyId,
                userId
            );

            return ApiResponse.success(res, batch, 'Lote de nóminas generado automáticamente desde datos de Kiosco');
        } catch (error: any) {
            log.error({ error }, 'Payroll Generation Error');
            return ApiResponse.error(res, 'Error al generar nóminas automáticas: ' + error.message, 500);
        }
    }
};
