import { Router } from 'express';
import multer from 'multer';
import { ExpenseController } from '../controllers/ExpenseController';
import { createMulterOptions } from '../config/multer';
import { authorize } from '../middlewares/authMiddleware';
import { validateResource } from '../middlewares/validateResource';
import { expenseCreateSchema, expenseUpdateSchema, expenseApprovalSchema, expenseIdParamSchema } from '../schemas/expenseSchemas';
import { prisma } from '../lib/prisma';

const router = Router();

const upload = multer(createMulterOptions('uploads/expenses/'));

const resolveExpenseEmployeeTarget = async (req: any) => {
    const employeeId = req.params.employeeId || req.body.employeeId;

    if (!employeeId) {
        return null;
    }

    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, companyId: true }
    });

    return employee
        ? { employeeId: employee.id, companyId: employee.companyId }
        : { employeeId };
};

const resolveExpenseTarget = async (req: any) => {
    const expense = await prisma.expense.findUnique({
        where: { id: req.params.id },
        select: {
            employeeId: true,
            employee: { select: { companyId: true } }
        }
    });

    return expense
        ? { employeeId: expense.employeeId, companyId: expense.employee?.companyId }
        : null;
};

router.get('/', authorize('expense.manage', (req: any) => ({ companyId: req.user?.companyId })), ExpenseController.getAll);
router.get('/employee/:employeeId', validateResource(expenseIdParamSchema), authorize('expense.read', resolveExpenseEmployeeTarget), ExpenseController.getByEmployee);
router.post('/upload', validateResource(expenseCreateSchema), upload.single('receipt'), authorize('expense.write', resolveExpenseEmployeeTarget), ExpenseController.upload);
router.post('/ocr', upload.single('receipt'), ExpenseController.processOCR);
router.put('/:id/status', validateResource(expenseIdParamSchema), validateResource(expenseApprovalSchema), authorize('expense.manage', resolveExpenseTarget), ExpenseController.updateStatus);
router.get('/:id/receipt', validateResource(expenseIdParamSchema), authorize('expense.read', resolveExpenseTarget), ExpenseController.getReceipt);
router.delete('/:id', validateResource(expenseIdParamSchema), authorize('expense.write', resolveExpenseTarget), ExpenseController.delete);

export default router;
