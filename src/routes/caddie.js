import { Router } from 'express';
import { body } from 'express-validator';
import {
  getAllCaddies,
  getCaddieById,
  getCaddiesByList,
  getCaddieStatistics,
  getCaddiesQueue,
  getCaddiesReturns,
  getCaddiesByAvailability,
  createCaddie,
  updateCaddie,
  deleteCaddie,
  updateCaddieStatus,
} from '../controllers/caddieController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

// GET /caddies - Get all caddies with optional filtering
router.get('/', authenticate, getAllCaddies);

// GET /caddies/statistics - Get caddie statistics
router.get('/statistics', authenticate, getCaddieStatistics);

// GET /caddies/queue - Get caddies for queue
router.get('/queue', authenticate, getCaddiesQueue);

// GET /caddies/returns - Get caddies that need to return
router.get('/returns', authenticate, getCaddiesReturns);

// GET /caddies/availability/:day - Get caddies available on a specific day
router.get('/availability/:day', authenticate, getCaddiesByAvailability);

// GET /caddies/list/:listNumber - Legacy support
router.get('/list/:listNumber', optionalAuth, getCaddiesByList);

// GET /caddies/:id - Get a single caddie
router.get('/:id', authenticate, getCaddieById);

// POST /caddies - Create a new caddie
router.post(
  '/',
  authenticate,
  [
    body('name').isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('number').isInt({ min: 1, max: 999 }).withMessage('Number must be between 1 and 999'),
    body('category').isIn(['Primera', 'Segunda', 'Tercera']).withMessage('Invalid category'),
    body('location').isIn(['Llanogrande', 'Medellín']).withMessage('Invalid location'),
    body('role').isIn(['Golf', 'Tennis', 'Hybrid']).withMessage('Invalid role'),
  ],
  createCaddie
);

// PUT /caddies/:id - Update a caddie
router.put('/:id', authenticate, updateCaddie);

// DELETE /caddies/:id - Soft delete a caddie
router.delete('/:id', authenticate, deleteCaddie);

// PATCH /caddies/:id/status - Update caddie status
router.patch(
  '/:id/status',
  authenticate,
  [
    body('status')
      .isIn(['AVAILABLE', 'IN_PREP', 'IN_FIELD', 'LATE', 'ABSENT', 'ON_LEAVE'])
      .withMessage('Invalid status'),
  ],
  updateCaddieStatus
);

export default router;
