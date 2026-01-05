import { Router } from 'express';
import { body } from 'express-validator';
import {
  getAllCaddies,
  getCaddieById,
  getCaddiesByList,
  createCaddie,
  updateCaddie,
  deleteCaddie,
  updateCaddieStatus,
} from '../controllers/caddieController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Public routes for viewing
router.get('/', optionalAuth, getAllCaddies);
router.get('/:id', optionalAuth, getCaddieById);
router.get('/list/:listNumber', optionalAuth, getCaddiesByList);

// Admin only routes for management
router.post(
  '/',
  authenticate,
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('listNumber').isIn(['1', '2', '3']).withMessage('ListNumber must be 1, 2, or 3'),
  ],
  createCaddie
);

router.put(
  '/:id',
  authenticate,
  [body('listNumber').optional().isIn(['1', '2', '3']).withMessage('ListNumber must be 1, 2, or 3')],
  updateCaddie
);

// PATCH /:id/status - Update caddie status (emits WebSocket event)
router.patch(
  '/:id/status',
  authenticate,
  [
    body('status')
      .isIn(['Disponible', 'En campo', 'Ausente'])
      .withMessage('Status must be: Disponible, En campo, or Ausente'),
  ],
  updateCaddieStatus
);

router.delete('/:id', authenticate, deleteCaddie);

export default router;
