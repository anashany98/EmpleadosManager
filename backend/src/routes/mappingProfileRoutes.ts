import { Router } from 'express';
import { MappingProfileController } from '../controllers/MappingProfileController';

const router = Router();
const controller = new MappingProfileController();

router.get('/', controller.getProfiles);
router.post('/', controller.createProfile);
router.delete('/:id', controller.deleteProfile);

import { FileMappingController } from '../controllers/FileMappingController';

router.get('/file-mappings', FileMappingController.getAll);
router.post('/file-mappings', FileMappingController.create);
router.put('/file-mappings/:id', FileMappingController.update);
router.delete('/file-mappings/:id', FileMappingController.delete);

export default router;
