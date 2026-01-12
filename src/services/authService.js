import prisma from '../config/database.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { generateToken } from '../utils/jwt.js';

/**
 * AuthService - Handles authentication and user management
 */
export class AuthService {
  /**
   * Login user and generate JWT token
   */
  async login(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Find user by email
    let user = await prisma.user.findUnique({
      where: { email },
    });

    // If no users exist, create a default admin (for initial setup)
    if (!user) {
      const userCount = await prisma.user.count();
      if (userCount === 0 && email === 'admin@campestre.com') {
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
      } else {
        throw new Error('Invalid credentials');
      }
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is inactive');
    }

    // Verify password
    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      location: user.location,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        location: user.location,
      },
    };
  }

  /**
   * Register a new user
   */
  async register(email, password, role, location) {
    if (!email || !password || !role || !location) {
      throw new Error('All fields are required');
    }

    const validRoles = ['admin', 'operator'];
    if (!validRoles.includes(role)) {
      throw new Error(`Role must be one of: ${validRoles.join(', ')}`);
    }

    const validLocations = ['Llanogrande', 'Medellín'];
    if (!validLocations.includes(location)) {
      throw new Error(`Location must be one of: ${validLocations.join(', ')}`);
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new Error('A user with this email already exists');
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

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      location: user.location,
    };
  }
}

export const authService = new AuthService();
