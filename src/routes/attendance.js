import { Router } from 'express';
import { body } from 'express-validator';
import {
  getAllAttendance,
  getAttendanceById,
  createAttendance,
  updateAttendance,
  getAttendanceByCaddie,
  getAttendanceByList,
  getAttendanceByDate,
} from '../controllers/attendanceController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Public routes for viewing
router.get('/', optionalAuth, getAllAttendance);
router.get('/:id', optionalAuth, getAttendanceById);
router.get('/caddie/:caddieId', optionalAuth, getAttendanceByCaddie);
router.get('/list/:listNumber', optionalAuth, getAttendanceByList);
router.get('/date/:date', optionalAuth, getAttendanceByDate);

// Admin only routes for management
router.post(
  '/',
  authenticate,
  [
    body('caddieId').notEmpty().withMessage('CaddieId is required'),
    body('date').notEmpty().withMessage('Date is required'),
    body('status')
      .isIn(['Presente', 'Llegó tarde', 'No vino', 'Permiso'])
      .withMessage('Invalid status'),
  ],
  createAttendance
);

router.put(
  '/:id',
  authenticate,
  body('status')
    .optional()
    .isIn(['Presente', 'Llegó tarde', 'No vino', 'Permiso'])
    .withMessage('Invalid status'),
  updateAttendance
);

export default router;
