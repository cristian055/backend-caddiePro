import prisma from '../config/database.js';
import { comparePassword } from '../utils/password.js';
import { generateToken } from '../utils/jwt.js';

export const login = async (req, res) => {
  try {
    const { password } = req.body;

    console.log('[AUTH] Login attempt with password:', password);

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Check if admin exists, if not create one (for setup)
    let admin = await prisma.admin.findFirst();

    console.log('[AUTH] Admin found:', admin ? 'Yes' : 'No');

    if (!admin) {
      console.log('[AUTH] Creating default admin...');
      // Create default admin with password "admin123"
      const bcrypt = await import('bcryptjs');
      const hashPassword = async (password) => {
        const salt = await bcrypt.genSalt(10);
        return bcrypt.hash(password, salt);
      };
      const hashedPassword = await hashPassword('admin123');
      console.log('[AUTH] Default admin password hash:', hashedPassword.substring(0, 20) + '...');
      admin = await prisma.admin.create({
        data: { password: hashedPassword },
      });
      console.log('[AUTH] Admin created with ID:', admin.id);
    }

    console.log('[AUTH] Comparing passwords...');
    const isMatch = await comparePassword(password, admin.password);

    console.log('[AUTH] Password match:', isMatch);

    if (!isMatch) {
      console.log('[AUTH] Login failed: Invalid password');
      return res.status(401).json({ error: 'Invalid password' });
    }

    const token = generateToken({ adminId: admin.id });

    console.log('[AUTH] Login successful for admin:', admin.id);

    res.json({
      token,
      admin: true,
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const verify = async (req, res) => {
  try {
    res.json({ valid: true, user: req.user });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const logout = async (req, res) => {
  try {
    // For stateless JWT, logout is handled on client side
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
