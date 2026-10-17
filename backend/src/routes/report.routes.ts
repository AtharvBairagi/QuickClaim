import { Router } from 'express';
import { getReportsSummary } from '../controllers/report.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All report routes require authentication
router.use(authenticate);

router.get('/summary', getReportsSummary);

export default router;
