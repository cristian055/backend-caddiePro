import { Router } from 'express';
import { body } from 'express-validator';
import {
  getAllListSettings,
  getListSettings,
  updateListSettings,
  updateListOrder,
  updateListRange,
  getQueueForList,
} from '../controllers/listSettingsController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Public routes for viewing
router.get('/', optionalAuth, getAllListSettings);
router.get('/:listNumber', optionalAuth, getListSettings);
router.get('/:listNumber/queue', optionalAuth, getQueueForList);

// Admin only routes for management
router.put('/:listNumber', authenticate, updateListSettings);
router.put('/:listNumber/order', authenticate, updateListOrder);
router.put('/:listNumber/range', authenticate, updateListRange);

export default router;
