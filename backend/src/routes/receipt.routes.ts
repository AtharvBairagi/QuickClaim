import { Router } from 'express';
import { upload } from '../config/multer';
import {
  uploadReceipt,
  getReceipt,
  downloadReceipt,
  deleteReceipt,
} from '../controllers/receipt.controller';
import { authenticate } from '../middleware/auth.middleware';

// mergeParams: true allows us to access :productId from the parent router
const router = Router({ mergeParams: true });

// All receipt routes require authentication
router.use(authenticate);

// We assume validateObjectId for :productId is handled by the parent router or applied here if needed.
// In our setup, we will rely on the parent or service for validation, but for robustness we can 
// apply validateObjectId to productId if we want. The service already validates existence.

router.post('/', upload.single('file'), uploadReceipt);
router.get('/', getReceipt);
router.get('/download', downloadReceipt);
router.delete('/', deleteReceipt);

export default router;
