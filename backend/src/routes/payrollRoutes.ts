import { Router, Request, Response } from 'express';
import multer from 'multer';
import { PayrollBatchController } from '../controllers/PayrollBatchController';
import { PayrollRowController } from '../controllers/PayrollRowController';
import { PayrollEmployeeController } from '../controllers/PayrollEmployeeController';
import { createMulterOptions } from '../config/multer';
import { prisma } from '../lib/prisma';

import { authorize, checkPermission } from '../middlewares/authMiddleware';
import { AuthenticatedRequest } from '../types/express';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';
import { PayrollAutomationService } from '../services/PayrollAutomationService';

const router = Router();

const upload = multer(createMulterOptions('uploads/payroll/', ['.xlsx', '.xls', '.csv']));

const resolveEmployeePayrollTarget = async (req: any) => {
    const employeeId = req.params.employeeId;
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, companyId: true }
    });

    return employee
        ? { employeeId: employee.id, companyId: employee.companyId }
        : { employeeId };
};

const resolvePayrollTarget = async (req: any) => {
    const payrollId = req.params.id;
    const payroll = await prisma.payrollRow.findUnique({
        where: { id: payrollId },
        select: {
            employeeId: true,
            employee: { select: { companyId: true } }
        }
    });

    return payroll
        ? { employeeId: payroll.employeeId, companyId: payroll.employee?.companyId }
        : null;
};

// Admin / Write Access
router.get('/', checkPermission('payroll', 'read'), PayrollBatchController.getLatest);
router.post('/upload', checkPermission('payroll', 'write'), upload.single('file'), PayrollBatchController.upload);
router.post('/generate-from-kiosk', checkPermission('payroll', 'write'), async (req: Request, res: Response) => {
    try {
        const { year, month, companyId } = req.body;
        const { user } = req as AuthenticatedRequest;
        const userId = user?.id || 'system';

        if (!year || !month || !companyId) {
            return ApiResponse.error(res, 'Año, mes y empresa son obligatorios', 400);
        }

        if (user.role !== 'admin') {
            if (companyId !== user.companyId) throw new AppError('No puedes generar nóminas para otra empresa', 403);
        }

        const batch = await PayrollAutomationService.generateFromAttendance(
            Number(year),
            Number(month),
            companyId,
            userId
        );

        return ApiResponse.success(res, batch, 'Lote de nóminas generado automáticamente desde datos de Kiosco');
    } catch (error: any) {
        return ApiResponse.error(res, 'Error al generar nóminas automáticas: ' + error.message, 500);
    }
});
router.post('/:id/map', checkPermission('payroll', 'write'), PayrollBatchController.applyMapping);
router.get('/:id/rows', checkPermission('payroll', 'write'), PayrollBatchController.getRows);
router.get('/row/:rowId/breakdown', checkPermission('payroll', 'write'), PayrollRowController.getBreakdown);
router.post('/row/:rowId/breakdown', checkPermission('payroll', 'write'), PayrollRowController.saveBreakdown);
router.post('/manual', checkPermission('payroll', 'write'), PayrollEmployeeController.createManual);

// Read / Self-Service
router.get('/employee/:employeeId', authorize('payroll.read', resolveEmployeePayrollTarget), PayrollEmployeeController.getByEmployee);
router.get('/:id/pdf', authorize('payroll.read', resolvePayrollTarget), PayrollEmployeeController.downloadPdf);

export default router;
