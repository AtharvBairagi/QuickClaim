import { Router } from 'express';
import {
  generateNotifications,
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
} from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateNotificationId } from '../middleware/productValidation.middleware';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

router.post('/generate', generateNotifications);
router.get('/', getNotifications);
// Ensure /unread-count is registered before /:id/read
router.get('/unread-count', getUnreadCount);
router.patch('/:id/read', validateNotificationId, markNotificationAsRead);

export default router;
