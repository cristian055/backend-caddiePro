import prisma from '../config/database.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { generateToken } from '../utils/jwt.js';

/**
 * POST /auth/login
 * Login to receive JWT token
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('[AUTH] Login attempt for:', email);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' },
      });
    }

    // Find user by email
    let user = await prisma.user.findUnique({
      where: { email },
    });

    // If no users exist, create a default admin (for initial setup)
    if (!user) {
      const userCount = await prisma.user.count();
      if (userCount === 0 && email === 'admin@campestre.com') {
        console.log('[AUTH] Creating default admin user...');
        const hashedPassword = await hashPassword('admin123');
        user = await prisma.user.create({
          data: {
            email: 'admin@campestre.com',
            passwordHash: hashedPassword,
            role: 'admin',
            location: 'Llanogrande',
            isActive: true,
          },
        });
        console.log('[AUTH] Default admin created. Password: admin123');
      } else {
        console.log('[AUTH] Login failed: User not found');
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
        });
      }
    }

    // Check if user is active
    if (!user.isActive) {
      console.log('[AUTH] Login failed: User is inactive');
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Account is inactive' },
      });
    }

    // Verify password
    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      console.log('[AUTH] Login failed: Invalid password');
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
      });
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      location: user.location,
    });

    console.log('[AUTH] Login successful for:', user.email);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          location: user.location,
        },
      },
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

/**
 * GET /auth/verify
 * Verify JWT token
 */
export const verify = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        valid: true,
        user: req.user,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

/**
 * POST /auth/logout
 * Logout (stateless - handled on client side)
 */
export const logout = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

/**
 * POST /auth/register (Admin only)
 * Register a new user
 */
export const register = async (req, res) => {
  try {
    const { email, password, role, location } = req.body;

    // Validation
    if (!email || !password || !role || !location) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'All fields are required' },
      });
    }

    const validRoles = ['admin', 'operator'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Role must be one of: ${validRoles.join(', ')}` },
      });
    }

    const validLocations = ['Llanogrande', 'Medellín'];
    if (!validLocations.includes(location)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Location must be one of: ${validLocations.join(', ')}` },
      });
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_ENTRY', message: 'A user with this email already exists' },
      });
    }

    // Create user
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        role,
        location,
        isActive: true,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        location: user.location,
      },
    });
  } catch (error) {
    console.error('[AUTH] Register error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};
