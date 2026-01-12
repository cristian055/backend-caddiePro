import prisma from '../config/database.js';
import { VALID_DAYS, VALID_CATEGORIES } from '../validators/validators.js';

/**
 * PublicService - Handles public-facing data queries
 */
export class PublicService {
  /**
   * Get current queue state for public monitor
   */
  async getPublicQueue() {
    const listConfigs = await prisma.listConfig.findMany();

    const queue = {
      Primera: [],
      Segunda: [],
      Tercera: [],
    };

    for (const config of listConfigs) {
      const caddies = await prisma.caddie.findMany({
        where: {
          isActive: true,
          category: config.category,
          status: { in: ['AVAILABLE', 'LATE'] },
          number: {
            gte: config.rangeStart,
            lte: config.rangeEnd,
          },
        },
        orderBy: this.getOrderBy(config.orderType),
        take: 5,
      });

      queue[config.category] = caddies.map(c => ({
        id: c.id,
        name: c.name,
        number: c.number,
        status: c.status,
        category: c.category,
        weekendPriority: c.weekendPriority,
      }));
    }

    // If no configs exist, get caddies by default order
    for (const category of VALID_CATEGORIES) {
      if (queue[category].length === 0) {
        const caddies = await prisma.caddie.findMany({
          where: {
            isActive: true,
            category,
            status: { in: ['AVAILABLE', 'LATE'] },
          },
          orderBy: [{ number: 'asc' }],
          take: 5,
        });

        queue[category] = caddies.map(c => ({
          id: c.id,
          name: c.name,
          number: c.number,
          status: c.status,
          category: c.category,
          weekendPriority: c.weekendPriority,
        }));
      }
    }

    return {
      ...queue,
      lastUpdate: new Date().toISOString(),
    };
  }

  /**
   * Get all caddies organized by list/category (public access)
   */
  async getPublicCaddies(filters = {}) {
    const { status, location } = filters;

    const where = {
      isActive: true,
    };

    if (status) {
      where.status = status;
    }

    if (location) {
      where.location = location;
    }

    const caddiesByCategory = {};

    for (const category of VALID_CATEGORIES) {
      const caddies = await prisma.caddie.findMany({
        where: {
          ...where,
          category,
        },
        orderBy: [{ number: 'asc' }],
      });

      caddiesByCategory[category] = caddies.map(c => ({
        id: c.id,
        name: c.name,
        number: c.number,
        status: c.status,
        category: c.category,
        weekendPriority: c.weekendPriority,
        location: c.location,
        role: c.role,
      }));
    }

    return {
      ...caddiesByCategory,
      lastUpdate: new Date().toISOString(),
    };
  }

  /**
   * Get caddies from a specific list (public access)
   */
  async getPublicCaddiesByList(listNumber, filters = {}) {
    const { status } = filters;

    if (!['1', '2', '3'].includes(listNumber)) {
      throw new Error('Invalid list number. Must be 1, 2, or 3');
    }

    const LIST_TO_CATEGORY = {
      '1': 'Primera',
      '2': 'Segunda',
      '3': 'Tercera',
    };

    const category = LIST_TO_CATEGORY[listNumber];
    const where = {
      isActive: true,
      category,
    };

    if (status) {
      where.status = status;
    }

    const caddies = await prisma.caddie.findMany({
      where,
      orderBy: [{ number: 'asc' }],
    });

    return {
      listNumber: parseInt(listNumber),
      category,
      caddies: caddies.map(c => ({
        id: c.id,
        name: c.name,
        number: c.number,
        status: c.status,
        category: c.category,
        weekendPriority: c.weekendPriority,
        location: c.location,
        role: c.role,
      })),
      lastUpdate: new Date().toISOString(),
    };
  }

  /**
   * Get weekly schedule (read-only)
   */
  async getPublicWeekly(filters = {}) {
    const { day, location } = filters;

    const shiftWhere = {};
    if (day && VALID_DAYS.includes(day)) shiftWhere.day = day;
    if (location) shiftWhere.location = location;

    const shifts = await prisma.weeklyShift.findMany({
      where: shiftWhere,
      include: {
        requirements: true,
        assignments: true,
      },
      orderBy: [{ day: 'asc' }, { time: 'asc' }],
    });

    return {
      day: day || 'all',
      shifts: shifts.map(s => ({
        id: s.id,
        day: s.day,
        time: s.time,
        location: s.location,
        requirements: s.requirements.map(r => ({
          category: r.category,
          count: r.count,
        })),
      })),
      assignments: shifts.flatMap(s =>
        s.assignments.map(a => ({
          shiftId: a.shiftId,
          caddieId: a.caddieId,
          caddieName: a.caddieName,
          caddieNumber: a.caddieNumber,
          category: a.category,
          time: s.time,
          day: s.day,
        }))
      ),
    };
  }

  /**
   * Helper function to get order by based on order type
   */
  getOrderBy(orderType) {
    switch (orderType) {
      case 'DESC':
        return [{ number: 'desc' }];
      case 'RANDOM':
      case 'MANUAL':
        return [{ weekendPriority: 'asc' }];
      case 'ASC':
      default:
        return [{ number: 'asc' }];
    }
  }
}

export const publicService = new PublicService();
