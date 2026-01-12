import { authService } from '../services/authService.js';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('[AUTH] Login attempt for:', email);

    const result = await authService.login(email, password);

    console.log('[AUTH] Login successful for:', result.user.email);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    const statusCode = error.message.includes('credentials') ? 401 : 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: statusCode === 401 ? 'UNAUTHORIZED' : 'INTERNAL_ERROR',
        message: error.message || 'Internal server error'
      },
    });
  }
};

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
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' },
    });
  }
};

export const logout = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' },
    });
  }
};

export const register = async (req, res) => {
  try {
    const { email, password, role, location } = req.body;

    const result = await authService.register(email, password, role, location);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[AUTH] Register error:', error);
    const statusCode = error.message.includes('must be') ? 400 :
                     error.message.includes('already exists') ? 409 : 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: statusCode === 409 ? 'DUPLICATE_ENTRY' : statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
        message: error.message || 'Internal server error'
      },
    });
  }
};
