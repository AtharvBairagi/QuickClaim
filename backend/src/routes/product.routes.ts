import { Router } from 'express';
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  searchProducts,
  getExpiringProducts,
} from '../controllers/product.controller';
import { getSharedWithMeProducts } from '../controllers/ownership.controller';
import { authenticate } from '../middleware/auth.middleware';
import {
  validateObjectId,
  validateCreateProduct,
  validateUpdateProduct,
  validateSearchQuery,
} from '../middleware/productValidation.middleware';
import receiptRoutes from './receipt.routes';
import ownershipRoutes from './ownership.routes';

const router = Router();

// All product routes require authentication
router.use(authenticate);

router.post('/', validateCreateProduct, createProduct);
router.get('/', getProducts);

// Registered before /:id so literal routes are not matched as ObjectId params
router.get('/search', validateSearchQuery, searchProducts);
router.get('/expiring', getExpiringProducts);
router.get('/shared-with-me', getSharedWithMeProducts);

router.get('/:id', validateObjectId, getProductById);
router.put('/:id', validateObjectId, validateUpdateProduct, updateProduct);
router.delete('/:id', validateObjectId, deleteProduct);

// Mount receipt routes under /:productId/receipt
router.use('/:productId/receipt', validateObjectId, receiptRoutes);

// Mount ownership routes under /:productId/ownership
router.use('/:productId/ownership', validateObjectId, ownershipRoutes);

export default router;
