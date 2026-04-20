import { Router } from 'express';
import { InventoryController } from '../controllers/InventoryController';
import { protect, checkPermission, requireGlobalAdmin } from '../middlewares/authMiddleware';

const router = Router();

router.use(protect); // All inventory routes are protected

router.get('/', checkPermission('assets', 'read'), requireGlobalAdmin, InventoryController.getAll);
router.post('/', checkPermission('assets', 'write'), requireGlobalAdmin, InventoryController.create);
router.put('/:id', checkPermission('assets', 'write'), requireGlobalAdmin, InventoryController.update);
router.delete('/:id', checkPermission('assets', 'write'), requireGlobalAdmin, InventoryController.delete);
router.post('/:id/stock', checkPermission('assets', 'write'), requireGlobalAdmin, InventoryController.addStock);
router.post('/:id/distribute', checkPermission('assets', 'write'), requireGlobalAdmin, InventoryController.distribute);
router.get('/:id/movements', checkPermission('assets', 'read'), requireGlobalAdmin, InventoryController.getMovements);
router.post('/:id/generate-receipt', checkPermission('assets', 'write'), requireGlobalAdmin, InventoryController.generateReceipt);

export const inventoryRoutes = router;
