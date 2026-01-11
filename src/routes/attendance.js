import { Router } from 'express';
import { createDailyAttendance, getDailyAttendance, getDailyAttendanceStats, updateDailyAttendance } from '../controllers/attendanceController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Public routes for viewing
router.get('/daily/:date', optionalAuth, getDailyAttendance);
router.get('/daily/:date/stats', optionalAuth, getDailyAttendanceStats);

// Admin only routes for management
router.post('/daily', authenticate, createDailyAttendance);
router.put('/daily/:id', authenticate, updateDailyAttendance);

export default router;
