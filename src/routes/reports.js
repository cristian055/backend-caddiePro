import { Router } from 'express';
import { getDailyReport, getRangeReport, downloadCsvReport } from '../controllers/reportsController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Public routes for viewing
router.get('/daily/:date', optionalAuth, getDailyReport);
router.get('/range/:startDate/:endDate', optionalAuth, getRangeReport);

// Admin only routes for management
router.get('/csv/:date', authenticate, downloadCsvReport);

export default router;
