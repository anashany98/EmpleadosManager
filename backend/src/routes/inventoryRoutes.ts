import { Router } from 'express';
import { InventoryController } from '../controllers/InventoryController';
import { protect } from '../middlewares/authMiddleware';

const router = Router();

router.use(protect); // All inventory routes are protected

router.get('/', InventoryController.getAll);
router.post('/', InventoryController.create);
router.put('/:id', InventoryController.update);
router.delete('/:id', InventoryController.delete);
router.post('/:id/stock', InventoryController.addStock);
router.post('/:id/distribute', InventoryController.distribute);
router.get('/:id/movements', InventoryController.getMovements);
router.post('/:id/generate-receipt', InventoryController.generateReceipt);

export const inventoryRoutes = router;
