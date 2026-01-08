import { Router } from 'express';
import { body } from 'express-validator';
import { login, verify, logout, register } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// POST /auth/login - Login to receive JWT token
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login
);

// POST /auth/logout - Logout
router.post('/logout', logout);

// GET /auth/verify - Verify JWT token
router.get('/verify', authenticate, verify);

// POST /auth/register - Register new user (Admin only)
router.post(
  '/register',
  authenticate,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['admin', 'operator']).withMessage('Role must be admin or operator'),
    body('location').isIn(['Llanogrande', 'Medellín']).withMessage('Invalid location'),
  ],
  register
);

export default router;
