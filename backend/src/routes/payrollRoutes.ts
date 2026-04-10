import { Router } from 'express';
import multer from 'multer';
import { PayrollController } from '../controllers/PayrollController';
import { createMulterOptions } from '../config/multer';
import { prisma } from '../lib/prisma';

import { authorize, checkPermission } from '../middlewares/authMiddleware';

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
router.get('/', checkPermission('payroll', 'read'), PayrollController.getLatestBatches);
router.post('/upload', checkPermission('payroll', 'write'), upload.single('file'), PayrollController.upload);
router.post('/generate-from-kiosk', checkPermission('payroll', 'write'), PayrollController.generateFromKiosk);
router.post('/:id/map', checkPermission('payroll', 'write'), PayrollController.applyMapping);
router.get('/:id/rows', checkPermission('payroll', 'write'), PayrollController.getRows);
router.get('/row/:rowId/breakdown', checkPermission('payroll', 'write'), PayrollController.getBreakdown);
router.post('/row/:rowId/breakdown', checkPermission('payroll', 'write'), PayrollController.saveBreakdown);
router.post('/manual', checkPermission('payroll', 'write'), PayrollController.createManualPayroll);

// Read / Self-Service
router.get('/employee/:employeeId', authorize('payroll.read', resolveEmployeePayrollTarget), PayrollController.getEmployeePayrolls);
router.get('/:id/pdf', authorize('payroll.read', resolvePayrollTarget), PayrollController.downloadPdf);

export default router;
