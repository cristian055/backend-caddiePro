import { Router } from 'express';
import { body } from 'express-validator';
import {
  getAllTurns,
  getTurnById,
  createTurn,
  updateTurn,
  getTurnsByCaddie,
  getTurnsByList,
  getTurnsByDate,
} from '../controllers/turnController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Public routes for viewing
router.get('/', optionalAuth, getAllTurns);
router.get('/:id', optionalAuth, getTurnById);
router.get('/caddie/:caddieId', optionalAuth, getTurnsByCaddie);
router.get('/list/:listNumber', optionalAuth, getTurnsByList);
router.get('/date/:date', optionalAuth, getTurnsByDate);

// Admin only routes for management
router.post(
  '/',
  authenticate,
  [
    body('caddieId').notEmpty().withMessage('CaddieId is required'),
    body('listNumber').isIn(['1', '2', '3']).withMessage('ListNumber must be 1, 2, or 3'),
  ],
  createTurn
);

router.put('/:id', authenticate, updateTurn);

export default router;
