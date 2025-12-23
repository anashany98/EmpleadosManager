import { Router } from 'express';
import { MappingProfileController } from '../controllers/MappingProfileController';

const router = Router();
const controller = new MappingProfileController();

router.get('/', controller.getProfiles);
router.post('/', controller.createProfile);
router.delete('/:id', controller.deleteProfile);

export default router;
