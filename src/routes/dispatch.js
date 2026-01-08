import { Router } from 'express';
import { body } from 'express-validator';
import { bulkDispatch } from '../controllers/dispatchController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// POST /dispatch/bulk - Bulk dispatch caddies
router.post(
  '/bulk',
  authenticate,
  [
    body('updates').isArray({ min: 1 }).withMessage('Updates array is required'),
    body('updates.*.id').notEmpty().withMessage('Caddie ID is required'),
    body('updates.*.status')
      .isIn(['AVAILABLE', 'IN_PREP', 'IN_FIELD', 'LATE', 'ABSENT', 'ON_LEAVE'])
      .withMessage('Invalid status'),
  ],
  bulkDispatch
);

export default router;
