import { Router } from 'express';
import multer from 'multer';
import { RateController, OvertimeController } from '../controllers/OvertimeController';
import { authorize, checkPermission, requireGlobalAdmin } from '../middlewares/authMiddleware';
import { prisma } from '../lib/prisma';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit for imports
});
const router = Router();

const resolveOvertimeEmployeeTarget = async (req: any) => {
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

const resolveStoredOvertimeTarget = async (req: any) => {
    const entry = await prisma.overtimeEntry.findUnique({
        where: { id: req.params.id },
        select: {
            employeeId: true,
            employee: {
                select: {
                    companyId: true
                }
            }
        }
    });

    return entry
        ? { employeeId: entry.employeeId, companyId: entry.employee?.companyId }
        : null;
};

// Rates
router.get('/rates', checkPermission('employees', 'read'), RateController.getAll);
router.post('/rates', requireGlobalAdmin, RateController.update);

// Overtime Entries
router.get('/employee/:employeeId', authorize('employee.read.detail', resolveOvertimeEmployeeTarget), OvertimeController.getByEmployee);
router.post('/', authorize('employee.write.company', resolveOvertimeEmployeeTarget), OvertimeController.create);
router.post('/import', requireGlobalAdmin, upload.single('file'), OvertimeController.importOvertime);
router.delete('/:id', authorize('employee.write.company', resolveStoredOvertimeTarget), OvertimeController.delete);

export default router;
