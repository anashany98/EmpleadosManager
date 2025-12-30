import { Router } from 'express';
import { FileController } from '../controllers/FileController';
import { protect } from '../middlewares/authMiddleware';

const router = Router();

router.get('/:filename', protect, FileController.getFile);

export default router;
