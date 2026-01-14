import { caddieService } from '../services/caddieService.js';
import { attendanceService } from '../services/attendanceService.js';
import { categoryPromotionService } from '../services/categoryPromotionService.js';
import { emitCaddieAdded, emitCaddieUpdated, emitCaddieDeleted, emitCaddieStatusChanged, emitDailyAttendanceUpdated, emitQueueUpdated } from '../utils/websocketEmitter.js';

/**
 * GET /caddies
 * Get all caddies with optional filtering
 */
export const getAllCaddies = async (req, res) => {
  try {
    const caddies = await caddieService.getAllCaddies(req.query);
    res.json({
      success: true,
      data: {
        caddies: caddies,
        total: caddies.length,
      },
    });
  } catch (error) {
    console.error('Get caddies error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' },
    });
  }
};

/**
 * GET /caddies/statistics
 * Get caddie statistics
 */
export const getCaddieStatistics = async (req, res) => {
  try {
    const stats = await caddieService.getCaddieStatistics();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' },
    });
  }
};

/**
 * GET /caddies/queue
 * Get caddies for queue (active and available/late)
 */
export const getCaddiesQueue = async (req, res) => {
  try {
    const queue = await caddieService.getCaddiesQueue();
    res.json({
      success: true,
      data: { queueCaddies: queue },
    });
  } catch (error) {
    console.error('Get queue error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' },
    });
  }
};

/**
 * GET /caddies/returns
 * Get caddies that need to return (IN_PREP or IN_FIELD status)
 */
export const getCaddiesReturns = async (req, res) => {
  try {
    const returns = await caddieService.getCaddiesReturns();
    res.json({
      success: true,
      data: { returnCaddies: returns },
    });
  } catch (error) {
    console.error('Get returns error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' },
    });
  }
};

/**
 * GET /caddies/availability/:day
 * Get caddies available on a specific day
 */
export const getCaddiesByAvailability = async (req, res) => {
  try {
    const { day } = req.params;
    const { includeInactive } = req.query;
    const result = await caddieService.getCaddiesByAvailability(day, includeInactive);
    res.json({
      success: true,
      data: {
        day,
        availableCaddies: result,
      },
    });
  } catch (error) {
    console.error('Get availability error:', error);
    const statusCode = error.message === 'Invalid day' ? 400 : 500;
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
 * GET /caddies/:id
 * Get a single caddie by ID
 */
export const getCaddieById = async (req, res) => {
  try {
    const { id } = req.params;
    const caddie = await caddieService.getCaddieById(id);
    if (!caddie) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Caddie not found' },
      });
    }
    res.json({
      success: true,
      data: caddie,
    });
  } catch (error) {
    console.error('Get caddie error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' },
    });
  }
};

/**
 * POST /caddies
 * Create a new caddie
 */
export const createCaddie = async (req, res) => {
  try {
    const result = await caddieService.createCaddie(req.body);
    emitCaddieAdded(result);
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Create caddie error:', error);
    const statusCode = error.message.includes('must be') ? 400 : 500;
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
 * PUT /caddies/:id
 * Update a caddie
 */
export const updateCaddie = async (req, res) => {
  try {
    const { id } = req.params;
    const { updates } = req.body;
    const { updated, numberReassigned } = await caddieService.updateCaddie(id, updates);

    emitCaddieUpdated(id, updates, updated.category);
    emitQueueUpdated(updated.category);

    res.json({
      success: true,
      data: { ...updated, numberReassigned: numberReassigned || false },
    });
  } catch (error) {
    console.error('Update caddie error:', error);
    const statusCode = error.message.includes('not found') ? 404 :
                     error.message.includes('must be') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: statusCode === 404 ? 'NOT_FOUND' : statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
        message: error.message || 'Internal server error'
      },
    });
  }
};

/**
 * DELETE /caddies/:id
 * Soft delete a caddie (set isActive = false)
 */
export const deleteCaddie = async (req, res) => {
  try {
    const { id } = req.params;
    const { id: caddieId, category } = await caddieService.deleteCaddie(id);
    emitCaddieDeleted(caddieId, category);
    res.json({
      success: true,
      message: 'Caddie deactivated successfully',
    });
  } catch (error) {
    console.error('Delete caddie error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
        message: error.message || 'Internal server error'
      },
    });
  }
};

/**
 * PATCH /caddies/:id/status
 * Update caddie operational status
 */
export const updateCaddieStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { caddie, previousStatus } = await caddieService.updateCaddieStatus(id, status);

    // Handle service completion (IN_FIELD from IN_PREP)
    if (status === 'IN_FIELD' && previousStatus === 'IN_PREP') {
      const attendance = await attendanceService.incrementServicesCount(id);
      emitDailyAttendanceUpdated(attendance);
    }

    emitCaddieStatusChanged(caddie, previousStatus);
    emitQueueUpdated(caddie.category);

    res.json({
      success: true,
      data: {
        id: caddie.id,
        name: caddie.name,
        number: caddie.number,
        operationalStatus: caddie.operationalStatus,
        previousStatus,
      },
    });
  } catch (error) {
    console.error('Update caddie status error:', error);
    const statusCode = error.message.includes('not found') ? 404 :
                     error.message.includes('must be') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: statusCode === 404 ? 'NOT_FOUND' : statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
        message: error.message || 'Internal server error'
      },
    });
  }
};

/**
 * POST /caddies/promote
 * Promote a caddie to a higher category
 */
export const promoteCaddie = async (req, res) => {
  try {
    const { caddieId, newCategory } = req.body;
    if (!caddieId || !newCategory) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'caddieId and newCategory are required' } });
    }

    const caddie = await caddieService.getCaddieById(caddieId);
    if (!caddie) {
      return res.status(404).json({ success: false, error: { code: 'CADDIE_NOT_FOUND', message: 'Caddie not found' } });
    }

    const result = await categoryPromotionService.promoteCaddie(caddieId, caddie.category, newCategory);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: result.error,
          message: getPromotionErrorMessage(result.error),
          details: result,
        },
      });
    }

    emitQueueUpdated(caddie.category);
    emitQueueUpdated(newCategory);

    return res.json({
      success: true,
      data: {
        caddie: result.caddie,
        oldPosition: result.oldPosition,
        newPosition: result.newPosition,
        queueRecalculated: true,
      },
    });
  } catch (error) {
    console.error('Promote caddie error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' },
    });
  }
};

function getPromotionErrorMessage(errorCode) {
  const messages = {
    CADDIE_NOT_IN_QUEUE: 'Caddie is not in queue',
    CADDIE_NOT_AVAILABLE: 'Caddie must be AVAILABLE to be promoted',
    CADDIE_IN_FIELD: 'Caddie is currently IN_FIELD and cannot be promoted',
    INVALID_TRANSITION: 'Cannot promote to this category',
  };
  return messages[errorCode] || 'Unknown promotion error';
}

// Legacy support
export const getCaddiesByList = async (req, res) => {
  try {
    const { listNumber } = req.params;
    const categoryMap = { '1': 'Primera', '2': 'Segunda', '3': 'Tercera' };
    const category = categoryMap[listNumber];

    if (!category) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid list number' },
      });
    }

    const caddies = await caddieService.getAllCaddies({ category });

    res.json({
      success: true,
      data: { caddies },
    });
  } catch (error) {
    console.error('Get caddies by list error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' },
    });
  }
};
