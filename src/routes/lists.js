import { Router } from 'express';
import { body } from 'express-validator';
import {
  getAllLists,
  getListByCategory,
  updateList,
  randomizeList,
  createList,
} from '../controllers/listSettingsController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

// GET /lists - Get all list configurations
router.get('/', optionalAuth, getAllLists);

// GET /lists/category/:category - Get list configuration for specific category
router.get('/category/:category', optionalAuth, getListByCategory);

// POST /lists - Create a new list configuration
router.post(
  '/',
  authenticate,
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('category').isIn(['Primera', 'Segunda', 'Tercera']).withMessage('Invalid category'),
    body('location').isIn(['Llanogrande', 'Medellín']).withMessage('Invalid location'),
    body('rangeStart').isInt({ min: 1, max: 999 }).withMessage('Invalid range start'),
    body('rangeEnd').isInt({ min: 1, max: 999 }).withMessage('Invalid range end'),
  ],
  createList
);

// PUT /lists/:id - Update list configuration
router.put('/:id', authenticate, updateList);

// POST /lists/:id/randomize - Randomize caddie order in list
router.post('/:id/randomize', authenticate, randomizeList);

export default router;
