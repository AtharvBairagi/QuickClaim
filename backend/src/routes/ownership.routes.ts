import { Router } from 'express';
import {
  shareProduct,
  getOwnerships,
  removeSharedAccess,
} from '../controllers/ownership.controller';
import { validateUserIdParam } from '../middleware/productValidation.middleware';

const router = Router({ mergeParams: true });

router.post('/', shareProduct);
router.get('/', getOwnerships);
router.delete('/:userId', validateUserIdParam, removeSharedAccess);

export default router;
