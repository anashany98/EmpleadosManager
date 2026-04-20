import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { PayrollPdfService } from '../services/PayrollPdfService';
import { EncryptionService } from '../services/EncryptionService';
import { AuthenticatedRequest } from '../types/express';
import { createLogger } from '../services/LoggerService';
import { AppError } from '../utils/AppError';

const log = createLogger('PayrollEmployeeController');

export const PayrollEmployeeController = {
    getByEmployee: async (req: Request, res: Response) => {
        const { employeeId } = req.params;
        const { user } = req as AuthenticatedRequest;

        try {
            const employee = await prisma.employee.findUnique({
                where: { id: employeeId },
                select: { id: true, companyId: true }
            });

            if (!employee) return ApiResponse.error(res, 'Empleado no encontrado', 404);

            if (user.role !== 'admin' && employee.companyId !== user.companyId) {
                throw new AppError('No autorizado', 403);
            }

            const payrolls = await prisma.payrollRow.findMany({
                where: { employeeId },
                include: { batch: { select: { year: true, month: true } }, items: true },
                orderBy: { batch: { month: 'desc' } }
            });

            return ApiResponse.success(res, payrolls);
        } catch (error: any) {
            log.error({ error }, 'Error fetching employee payrolls');
            return ApiResponse.error(res, 'Error al obtener nóminas');
        }
    },

    downloadPdf: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { user } = req as AuthenticatedRequest;

        try {
            const payroll = await prisma.payrollRow.findUnique({
                where: { id },
                include: {
                    batch: true,
                    employee: {
                        include: { company: true }
                    }
                }
            });

            if (!payroll) return ApiResponse.error(res, 'Nómina no encontrada', 404);
            if (!payroll.employee) return ApiResponse.error(res, 'Empleado no encontrado', 404);

            if (user.role !== 'admin' && payroll.employee.companyId !== user.companyId) {
                throw new AppError('No autorizado', 403);
            }

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
                    dni: payroll.employee.dni || '',
                    socialSecurityNumber: EncryptionService.decrypt(payroll.employee.socialSecurityNumber || '') || '',
                    jobTitle: payroll.employee.jobTitle || 'Empleado',
                    category: payroll.employee.category || undefined,
                    seniorityDate: payroll.employee.entryDate || undefined
                },
                items: []
            });
        } catch (error: any) {
            log.error({ error }, 'Error generating PDF');
            return ApiResponse.error(res, 'Error al generar PDF');
        }
    },

    createManual: async (req: Request, res: Response) => {
        const { year, month, employeeId, bruto, neto, ssEmpresa, ssTrabajador, irpf } = req.body;
        const { user } = req as AuthenticatedRequest;

        try {
            if (user.role !== 'admin') {
                throw new AppError('No autorizado', 403);
            }

            const employee = await prisma.employee.findUnique({
                where: { id: employeeId },
                select: { id: true, companyId: true }
            });

            if (!employee) return ApiResponse.error(res, 'Empleado no encontrado', 404);

            const batch = await prisma.payrollImportBatch.findFirst({
                where: {
                    year: Number(year),
                    month: Number(month),
                    sourceFilename: 'ENTRADA_MANUAL',
                    createdBy: { employee: { companyId: user.companyId } }
                }
            });

            const userId = user.id;
            const finalBatch = batch || await prisma.payrollImportBatch.create({
                data: {
                    year: Number(year),
                    month: Number(month),
                    sourceFilename: 'ENTRADA_MANUAL',
                    status: 'MAPPED',
                    createdById: userId
                }
            });

            const payroll = await prisma.payrollRow.create({
                data: {
                    batchId: finalBatch.id,
                    employeeId: employee.id,
                    bruto: parseFloat(bruto),
                    neto: parseFloat(neto),
                    ssEmpresa: parseFloat(ssEmpresa) || 0,
                    ssTrabajador: parseFloat(ssTrabajador) || 0,
                    irpf: parseFloat(irpf) || 0,
                    status: 'VALID',
                    rawEmployeeName: 'Manual Entry'
                }
            });

            return ApiResponse.success(res, payroll, 'Nómina manual creada');
        } catch (error: any) {
            log.error({ error }, 'Error creating manual payroll');
            return ApiResponse.error(res, 'Error al crear nómina manual');
        }
    }
};