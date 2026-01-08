import { Router } from 'express';
import { body } from 'express-validator';
import {
  getShifts,
  createShift,
  deleteShift,
  getAssignments,
  generateSchedule,
  resetSchedule,
} from '../controllers/scheduleController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /schedule/shifts - Get all weekly shifts
router.get('/shifts', authenticate, getShifts);

// POST /schedule/shifts - Create a new shift
router.post(
  '/shifts',
  authenticate,
  [
    body('day')
      .isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
      .withMessage('Invalid day'),
    body('time').matches(/^\d{2}:\d{2}$/).withMessage('Time must be in HH:mm format'),
    body('location').isIn(['Llanogrande', 'Medellín']).withMessage('Invalid location'),
  ],
  createShift
);

// DELETE /schedule/shifts/:id - Delete a shift
router.delete('/shifts/:id', authenticate, deleteShift);

// GET /schedule/assignments - Get all weekly assignments
router.get('/assignments', authenticate, getAssignments);

// POST /schedule/generate - Generate weekly draw
router.post(
  '/generate',
  authenticate,
  [
    body('day')
      .isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
      .withMessage('Invalid day'),
  ],
  generateSchedule
);

// POST /schedule/reset - Reset weekly schedule
router.post('/reset', authenticate, resetSchedule);

export default router;
