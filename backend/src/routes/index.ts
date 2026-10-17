import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import productRoutes from './product.routes';
import notificationRoutes from './notification.routes';
import reportRoutes from './report.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/notifications', notificationRoutes);
router.use('/reports', reportRoutes);

export default router;
