import { publicService } from '../services/publicService.js';

/**
 * GET /public/queue
 * Get current queue state for public monitor
 */
export const getPublicQueue = async (req, res) => {
  try {
    const queue = await publicService.getPublicQueue();
    res.json({
      success: true,
      data: queue,
    });
  } catch (error) {
    console.error('Get public queue error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' },
    });
  }
};

/**
 * GET /public/lists
 * Get all caddies organized by list/category (public access)
 */
export const getPublicCaddies = async (req, res) => {
  try {
    const { status, location } = req.query;
    const result = await publicService.getPublicCaddies({ status, location });
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Get public caddies error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' },
    });
  }
};

/**
 * GET /public/lists/:listNumber
 * Get caddies from a specific list (public access)
 */
export const getPublicCaddiesByList = async (req, res) => {
  try {
    const { listNumber } = req.params;
    const { status } = req.query;
    const result = await publicService.getPublicCaddiesByList(listNumber, { status });
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Get public caddies by list error:', error);
    const statusCode = error.message.includes('list number') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
        message: error.message || 'Internal server error'
      },
    });
  }
};

/**
 * GET /public/weekly
 * Get weekly schedule (read-only)
 */
export const getPublicWeekly = async (req, res) => {
  try {
    const { day, location } = req.query;
    const result = await publicService.getPublicWeekly({ day, location });
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Get public weekly error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' },
    });
  }
};
