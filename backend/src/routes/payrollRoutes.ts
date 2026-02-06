import { Router } from 'express';
import multer from 'multer';
import { PayrollController } from '../controllers/PayrollController';
import { createMulterOptions } from '../config/multer';

import { checkPermission, allowSelfOrRole } from '../middlewares/authMiddleware';

const router = Router();

const upload = multer(createMulterOptions('uploads/payroll/', ['.xlsx', '.xls', '.csv']));

// Admin / Write Access
router.post('/upload', checkPermission('payroll', 'write'), upload.single('file'), PayrollController.upload);
router.post('/:id/map', checkPermission('payroll', 'write'), PayrollController.applyMapping);
router.get('/:id/rows', checkPermission('payroll', 'write'), PayrollController.getRows);
router.get('/row/:rowId/breakdown', checkPermission('payroll', 'write'), PayrollController.getBreakdown);
router.post('/row/:rowId/breakdown', checkPermission('payroll', 'write'), PayrollController.saveBreakdown);
router.post('/manual', checkPermission('payroll', 'write'), PayrollController.createManualPayroll);

// Read / Self-Service
router.get('/employee/:employeeId', allowSelfOrRole(['admin'], 'employeeId'), PayrollController.getEmployeePayrolls);
router.get('/:id/pdf', PayrollController.downloadPdf); // Ownership checked in controller

export default router;
