import { Router } from 'express';
import { body } from 'express-validator';
import {
  getAllMessages,
  createMessage,
  deleteMessage,
  markMessageAsRead,
  getWhatsAppMessageUrl,
} from '../controllers/messagesController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Public routes for viewing
router.get('/', optionalAuth, getAllMessages);
router.get('/:id/whatsapp', optionalAuth, getWhatsAppMessageUrl);

// Admin only routes for management
router.post('/', authenticate, body('content').notEmpty().withMessage('Content is required'), createMessage);
router.delete('/:id', authenticate, deleteMessage);
router.put('/:id/read', authenticate, markMessageAsRead);

export default router;
