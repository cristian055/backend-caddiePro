import prisma from '../config/database.js';
import { VALID_CATEGORIES, VALID_LOCATIONS, VALID_ORDER_TYPES } from '../validators/validators.js';

/**
 * ListService - Handles list configuration business logic
 */
export class ListService {
  /**
   * Get all list configurations
   */
  async getAllLists() {
    const lists = await prisma.listConfig.findMany({
      orderBy: { category: 'asc' },
    });

    return lists.map(list => ({
      id: list.id,
      name: list.name,
      order: list.orderType,
      rangeStart: list.rangeStart,
      rangeEnd: list.rangeEnd,
      category: list.category,
      location: list.location,
    }));
  }

  /**
   * Get list configuration by category
   */
  async getListByCategory(category) {
    if (!VALID_CATEGORIES.includes(category)) {
      throw new Error(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`);
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

    return {
      id: list.id,
      name: list.name,
      order: list.orderType,
      rangeStart: list.rangeStart,
      rangeEnd: list.rangeEnd,
      category: list.category,
      location: list.location,
    };
  }

  /**
   * Update list configuration
   */
  async updateList(id, updates) {
    if (!updates) {
      throw new Error('Updates object is required');
    }

    const list = await prisma.listConfig.findUnique({ where: { id } });
    if (!list) {
      throw new Error('List not found');
    }

    const data = {};

    if (updates.name !== undefined) data.name = updates.name;
    if (updates.rangeStart !== undefined) {
      if (updates.rangeStart < 1 || updates.rangeStart > 999) {
        throw new Error('rangeStart must be between 1 and 999');
      }
      data.rangeStart = updates.rangeStart;
    }
    if (updates.rangeEnd !== undefined) {
      if (updates.rangeEnd < 1 || updates.rangeEnd > 999) {
        throw new Error('rangeEnd must be between 1 and 999');
      }
      data.rangeEnd = updates.rangeEnd;
    }
    if (updates.order !== undefined) {
      if (!VALID_ORDER_TYPES.includes(updates.order)) {
        throw new Error(`Order must be one of: ${VALID_ORDER_TYPES.join(', ')}`);
      }
      data.orderType = updates.order;
    }

    // Validate rangeStart < rangeEnd
    const finalRangeStart = data.rangeStart || list.rangeStart;
    const finalRangeEnd = data.rangeEnd || list.rangeEnd;
    if (finalRangeStart >= finalRangeEnd) {
      throw new Error('rangeStart must be less than rangeEnd');
    }

    const updatedList = await prisma.listConfig.update({
      where: { id },
      data,
    });

    return {
      id: updatedList.id,
      name: updatedList.name,
      order: updatedList.orderType,
      rangeStart: updatedList.rangeStart,
      rangeEnd: updatedList.rangeEnd,
      category: updatedList.category,
      location: updatedList.location,
    };
  }

  /**
   * Create new list configuration
   */
  async createList(data) {
    const { name, category, location, rangeStart, rangeEnd, order } = data;

    if (!name || !category || !location || rangeStart === undefined || rangeEnd === undefined) {
      throw new Error('All fields are required');
    }

    if (!VALID_CATEGORIES.includes(category)) {
      throw new Error(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }

    if (!VALID_LOCATIONS.includes(location)) {
      throw new Error(`Location must be one of: ${VALID_LOCATIONS.join(', ')}`);
    }

    if (rangeStart >= rangeEnd) {
      throw new Error('rangeStart must be less than rangeEnd');
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

    return {
      id: list.id,
      name: list.name,
      order: list.orderType,
      rangeStart: list.rangeStart,
      rangeEnd: list.rangeEnd,
      category: list.category,
      location: list.location,
    };
  }

  /**
   * Randomize caddie order in list
   */
  async randomizeList(id) {
    const list = await prisma.listConfig.findUnique({ where: { id } });
    if (!list) {
      throw new Error('List not found');
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

    return { message: 'List randomized successfully' };
  }
}

export const listService = new ListService();
