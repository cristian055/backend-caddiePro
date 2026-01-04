import { Router } from 'express';
import { body } from 'express-validator';
import { login, verify, logout } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post(
  '/login',
  [body('password').notEmpty().withMessage('Password is required')],
  login
);

router.post('/logout', logout);

router.get('/verify', authenticate, verify);

export default router;
