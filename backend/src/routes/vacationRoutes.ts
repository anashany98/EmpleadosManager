import { Router } from 'express';
import { VacationController } from '../controllers/VacationController';
import { authorize, protect } from '../middlewares/authMiddleware';
import { prisma } from '../lib/prisma';
import { validateResource } from '../middlewares/validateResource';
import { vacationCreateSchema, vacationStatusUpdateSchema, vacationIdParamSchema, vacationEmployeeParamSchema } from '../schemas/vacationSchemas';

import multer from 'multer';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const router = Router();

// Todas las rutas requieren autenticación
router.use(protect);

const resolveVacationEmployeeTarget = async (req: any) => {
    const employeeId = req.params.employeeId || req.body.employeeId || req.user?.employeeId;

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

const resolveVacationTarget = async (req: any) => {
    const vacation = await prisma.vacation.findUnique({
        where: { id: req.params.id },
        select: {
            employeeId: true,
            employee: { select: { companyId: true } }
        }
    });

    return vacation
        ? { employeeId: vacation.employeeId, companyId: vacation.employee?.companyId }
        : null;
};

router.get('/', authorize('vacation.manage', (req: any) => ({ companyId: req.user?.companyId })), VacationController.getAll);
router.get('/my-vacations', VacationController.getMyVacations);
router.get('/manage', authorize('vacation.manage', (req: any) => ({ companyId: req.user?.companyId })), VacationController.getManageableVacations);
router.get('/employee/:employeeId', validateResource(vacationEmployeeParamSchema), authorize('vacation.read', resolveVacationEmployeeTarget), VacationController.getByEmployee);
router.post('/', validateResource(vacationCreateSchema), upload.single('attachment'), authorize('vacation.write', resolveVacationEmployeeTarget), VacationController.create);
router.delete('/:id', validateResource(vacationIdParamSchema), authorize('vacation.write', resolveVacationTarget), VacationController.delete);
router.put('/:id/status', validateResource(vacationIdParamSchema), validateResource(vacationStatusUpdateSchema), authorize('vacation.manage', resolveVacationTarget), VacationController.updateStatus);
router.get('/:id/attachment', validateResource(vacationIdParamSchema), authorize('vacation.read', resolveVacationTarget), VacationController.downloadAttachment);

export default router;
