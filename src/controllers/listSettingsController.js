import prisma from '../config/database.js';

const VALID_CATEGORIES = ['Primera', 'Segunda', 'Tercera'];
const VALID_LOCATIONS = ['Llanogrande', 'Medellín'];
const VALID_ORDER_TYPES = ['ASC', 'DESC', 'RANDOM', 'MANUAL'];

/**
 * GET /lists
 * Get all list configurations
 */
export const getAllLists = async (req, res) => {
  try {
    const lists = await prisma.listConfig.findMany({
      orderBy: { category: 'asc' },
    });

    res.json({
      success: true,
      data: {
        lists: lists.map(list => ({
          id: list.id,
          name: list.name,
          order: list.orderType,
          rangeStart: list.rangeStart,
          rangeEnd: list.rangeEnd,
          category: list.category,
          location: list.location,
        })),
      },
    });
  } catch (error) {
    console.error('Get lists error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

/**
 * GET /lists/category/:category
 * Get list configuration for specific category
 */
export const getListByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` },
      });
    }

    let list = await prisma.listConfig.findFirst({
      where: { category },
    });

    // Create default list config if not exists
    if (!list) {
      const defaults = {
        'Primera': { rangeStart: 1, rangeEnd: 40 },
        'Segunda': { rangeStart: 41, rangeEnd: 80 },
        'Tercera': { rangeStart: 81, rangeEnd: 120 },
      };

      list = await prisma.listConfig.create({
        data: {
          name: `Lista ${category}`,
          orderType: 'ASC',
          rangeStart: defaults[category].rangeStart,
          rangeEnd: defaults[category].rangeEnd,
          category,
          location: 'Llanogrande',
        },
      });
    }

    res.json({
      success: true,
      data: {
        list: {
          id: list.id,
          name: list.name,
          order: list.orderType,
          rangeStart: list.rangeStart,
          rangeEnd: list.rangeEnd,
          category: list.category,
          location: list.location,
        },
      },
    });
  } catch (error) {
    console.error('Get list by category error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

/**
 * PUT /lists/:id
 * Update list configuration
 */
export const updateList = async (req, res) => {
  try {
    const { id } = req.params;
    const { updates } = req.body;

    if (!updates) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Updates object is required' },
      });
    }

    const list = await prisma.listConfig.findUnique({ where: { id } });
    if (!list) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'List not found' },
      });
    }

    const data = {};

    if (updates.name !== undefined) data.name = updates.name;
    if (updates.rangeStart !== undefined) {
      if (updates.rangeStart < 1 || updates.rangeStart > 999) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'rangeStart must be between 1 and 999' },
        });
      }
      data.rangeStart = updates.rangeStart;
    }
    if (updates.rangeEnd !== undefined) {
      if (updates.rangeEnd < 1 || updates.rangeEnd > 999) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'rangeEnd must be between 1 and 999' },
        });
      }
      data.rangeEnd = updates.rangeEnd;
    }
    if (updates.order !== undefined) {
      if (!VALID_ORDER_TYPES.includes(updates.order)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: `Order must be one of: ${VALID_ORDER_TYPES.join(', ')}` },
        });
      }
      data.orderType = updates.order;
    }

    // Validate rangeStart < rangeEnd
    const finalRangeStart = data.rangeStart || list.rangeStart;
    const finalRangeEnd = data.rangeEnd || list.rangeEnd;
    if (finalRangeStart >= finalRangeEnd) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'rangeStart must be less than rangeEnd' },
      });
    }

    const updatedList = await prisma.listConfig.update({
      where: { id },
      data,
    });

    res.json({
      success: true,
      data: {
        id: updatedList.id,
        name: updatedList.name,
        order: updatedList.orderType,
        rangeStart: updatedList.rangeStart,
        rangeEnd: updatedList.rangeEnd,
        category: updatedList.category,
        location: updatedList.location,
      },
    });
  } catch (error) {
    console.error('Update list error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

/**
 * POST /lists/:id/randomize
 * Randomize caddie order in list (update weekendPriority for caddies in range)
 */
export const randomizeList = async (req, res) => {
  try {
    const { id } = req.params;

    const list = await prisma.listConfig.findUnique({ where: { id } });
    if (!list) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'List not found' },
      });
    }

    // Get all active caddies in this category
    const caddies = await prisma.caddie.findMany({
      where: {
        category: list.category,
        isActive: true,
        number: {
          gte: list.rangeStart,
          lte: list.rangeEnd,
        },
      },
    });

    // Shuffle and assign new weekendPriority
    const shuffled = caddies.sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < shuffled.length; i++) {
      await prisma.caddie.update({
        where: { id: shuffled[i].id },
        data: { weekendPriority: i + 1 },
      });
    }

    // Update list order type to RANDOM
    await prisma.listConfig.update({
      where: { id },
      data: { orderType: 'RANDOM' },
    });

    res.json({
      success: true,
      message: 'List randomized successfully',
    });
  } catch (error) {
    console.error('Randomize list error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

/**
 * POST /lists
 * Create a new list configuration
 */
export const createList = async (req, res) => {
  try {
    const { name, category, location, rangeStart, rangeEnd, order } = req.body;

    // Validation
    if (!name || !category || !location || rangeStart === undefined || rangeEnd === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'All fields are required' },
      });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` },
      });
    }

    if (!VALID_LOCATIONS.includes(location)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Location must be one of: ${VALID_LOCATIONS.join(', ')}` },
      });
    }

    if (rangeStart >= rangeEnd) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'rangeStart must be less than rangeEnd' },
      });
    }

    const list = await prisma.listConfig.create({
      data: {
        name,
        category,
        location,
        rangeStart,
        rangeEnd,
        orderType: order || 'ASC',
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: list.id,
        name: list.name,
        order: list.orderType,
        rangeStart: list.rangeStart,
        rangeEnd: list.rangeEnd,
        category: list.category,
        location: list.location,
      },
    });
  } catch (error) {
    console.error('Create list error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

// ============================================
// Legacy support - Alias old functions
// ============================================
export const getAllListSettings = getAllLists;
export const getListSettings = async (req, res) => {
  req.params.category = { '1': 'Primera', '2': 'Segunda', '3': 'Tercera' }[req.params.listNumber] || req.params.listNumber;
  return getListByCategory(req, res);
};
export const updateListSettings = updateList;
