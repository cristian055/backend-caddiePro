import { verifyToken } from '../utils/jwt.js';

export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    console.log('[AUTH] Request:', req.method, req.path);
    console.log('[AUTH] Authorization header:', authHeader ? authHeader.substring(0, 50) + '...' : 'NONE');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[AUTH]  No valid Bearer token found');
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    console.log('[AUTH] Token extracted:', token.substring(0, 20) + '...');

    const decoded = verifyToken(token);
    console.log('[AUTH] Token valid for user:', decoded.adminId);

    req.user = decoded;
    next();
  } catch (error) {
    console.log('[AUTH]  Token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      req.user = decoded;
    }

    next();
  } catch (error) {
    // Continue without auth if token is invalid
    next();
  }
};
