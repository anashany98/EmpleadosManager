import { Router } from 'express';
import { VehicleController } from '../controllers/VehicleController';
import { protect, checkPermission } from '../middlewares/authMiddleware';

const router = Router();

// Protect all routes
router.use(protect);

// Read access: 'fleet:read' or admin
router.get('/', checkPermission('fleet', 'read'), VehicleController.getAll);
router.get('/:id', checkPermission('fleet', 'read'), VehicleController.getById);

// Write access: 'fleet:write' or admin
router.post('/', checkPermission('fleet', 'write'), VehicleController.create);
router.put('/:id', checkPermission('fleet', 'write'), VehicleController.update);
router.delete('/:id', checkPermission('fleet', 'write'), VehicleController.delete);

export default router;
