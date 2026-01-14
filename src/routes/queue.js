import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { queuePositionService } from '../services/queuePositionService.js';

const router = Router();

/**
 * GET /queue/:category
 * Get queue positions for a specific category
 */
router.get('/:category', authenticate, async (req, res) => {
  try {
    const { category } = req.params;
    
    // Validate category
    const validCategories = ['PRIMERA', 'SEGUNDA', 'TERCERA'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CATEGORY', message: 'Invalid category' },
      });
    }

    const queuePositions = await queuePositionService.getQueueByCategory(category);

    res.json({
      success: true,
      data: {
        queuePositions,
      },
    });
  } catch (error) {
    console.error('Get queue by category error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' },
    });
  }
});

export default router;
