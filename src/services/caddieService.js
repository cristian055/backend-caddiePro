import prisma from '../config/database.js';
import { VALID_CATEGORIES, VALID_LOCATIONS, VALID_ROLES, VALID_STATUSES } from '../validators/validators.js';

/**
 * CaddieService - Handles all caddie business logic
 */
export class CaddieService {
  /**
   * Get all caddies with optional filtering
   */
  async getAllCaddies(filters = {}) {
    const { searchTerm, category, activeStatus, location, role, includeInactive } = filters;

    const where = {};

    // Filter by active status
    if (activeStatus === 'Active') {
      where.isActive = true;
    } else if (activeStatus === 'Inactive') {
      where.isActive = false;
    } else if (!includeInactive || includeInactive === 'false') {
      where.isActive = true;
    }

    // Filter by category
    if (category && category !== 'All') {
      where.category = category;
    }

    // Filter by location
    if (location) {
      where.location = location;
    }

    // Filter by role
    if (role) {
      where.role = role;
    }

    // Search by name or number
    if (searchTerm) {
      const searchNumber = parseInt(searchTerm);
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        ...(isNaN(searchNumber) ? [] : [{ number: searchNumber }]),
      ];
    }

    const caddies = await prisma.caddie.findMany({
      where,
      include: {
        availability: true,
      },
      orderBy: [{ number: 'asc' }],
    });

    return this.formatCaddies(caddies);
  }

  /**
   * Format caddie data for API response
   */
  formatCaddies(caddies) {
    return caddies.map(caddie => ({
      id: caddie.id,
      name: caddie.name,
      number: caddie.number,
      status: caddie.status,
      isActive: caddie.isActive,
      category: caddie.category,
      location: caddie.location,
      role: caddie.role,
      weekendPriority: caddie.weekendPriority,
      isSkippedNextWeek: caddie.isSkippedNextWeek,
      historyCount: caddie.historyCount,
      absencesCount: caddie.absencesCount,
      lateCount: caddie.lateCount,
      leaveCount: caddie.leaveCount,
      lastActionTime: caddie.lastActionTime,
      availability: caddie.availability.map(a => ({
        day: a.day,
        isAvailable: a.isAvailable,
        range: a.rangeType ? {
          type: a.rangeType,
          time: a.rangeTime,
          endTime: a.rangeEndTime,
        } : null,
      })),
    }));
  }

  /**
   * Get caddie by ID
   */
  async getCaddieById(id) {
    const caddie = await prisma.caddie.findUnique({
      where: { id },
      include: {
        availability: true,
        dispatchHistory: {
          orderBy: { dispatchedAt: 'desc' },
          take: 10,
        },
        serviceLogs: {
          orderBy: { serviceDate: 'desc' },
          take: 30,
        },
      },
    });

    if (!caddie) {
      return null;
    }

    const formatted = this.formatCaddies([caddie])[0];
    formatted.dispatchHistory = caddie.dispatchHistory;
    formatted.serviceLogs = caddie.serviceLogs;

    return formatted;
  }

  /**
   * Get caddies for queue
   */
  async getCaddiesQueue() {
    const caddies = await prisma.caddie.findMany({
      where: {
        isActive: true,
        status: { in: ['AVAILABLE', 'LATE'] },
      },
      orderBy: [{ weekendPriority: 'asc' }, { number: 'asc' }],
    });

    return caddies.map(c => ({
      id: c.id,
      name: c.name,
      number: c.number,
      status: c.status,
      category: c.category,
      weekendPriority: c.weekendPriority,
    }));
  }

  /**
   * Get caddies that need to return
   */
  async getCaddiesReturns() {
    const caddies = await prisma.caddie.findMany({
      where: {
        isActive: true,
        status: { in: ['IN_PREP', 'IN_FIELD'] },
      },
      orderBy: [{ lastActionTime: 'asc' }],
    });

    return caddies.map(c => ({
      id: c.id,
      name: c.name,
      number: c.number,
      status: c.status,
      category: c.category,
    }));
  }

  /**
   * Get caddie statistics
   */
  async getCaddieStatistics() {
    const [total, active, byStatus, byCategory] = await Promise.all([
      prisma.caddie.count(),
      prisma.caddie.count({ where: { isActive: true } }),
      prisma.caddie.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.caddie.groupBy({
        by: ['category'],
        _count: { category: true },
        where: { isActive: true },
      }),
    ]);

    const statusCounts = {};
    VALID_STATUSES.forEach(s => statusCounts[s] = 0);
    byStatus.forEach(s => statusCounts[s.status] = s._count.status);

    const categoryCounts = {};
    VALID_CATEGORIES.forEach(c => categoryCounts[c] = 0);
    byCategory.forEach(c => {
      if (c.category) categoryCounts[c.category] = c._count.category;
    });

    return {
      total,
      active,
      inactive: total - active,
      byStatus: statusCounts,
      byCategory: categoryCounts,
    };
  }

  /**
   * Get caddies by availability on specific day
   */
  async getCaddiesByAvailability(day, includeInactive = false) {
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    if (!validDays.includes(day)) {
      throw new Error('Invalid day');
    }

    const where = {
      availability: {
        some: {
          day,
          isAvailable: true,
        },
      },
    };

    if (!includeInactive || includeInactive === 'false') {
      where.isActive = true;
    }

    const caddies = await prisma.caddie.findMany({
      where,
      include: { availability: true },
      orderBy: [{ weekendPriority: 'asc' }, { number: 'asc' }],
    });

    return caddies.map(c => ({
      id: c.id,
      name: c.name,
      number: c.number,
      category: c.category,
      weekendPriority: c.weekendPriority,
      availability: c.availability.map(a => ({
        day: a.day,
        isAvailable: a.isAvailable,
        range: a.rangeType ? {
          type: a.rangeType,
          time: a.rangeTime,
          endTime: a.rangeEndTime,
        } : null,
      })),
    }));
  }

  /**
   * Create a new caddie
   */
  async createCaddie(data) {
    const { name, number, category, location, role, availability, weekendPriority } = data;

    // Validation
    if (!name || name.length < 2 || name.length > 100) {
      throw new Error('Name must be between 2 and 100 characters');
    }

    if (!number || number < 1 || number > 999) {
      throw new Error('Number must be between 1 and 999');
    }

    if (!category || !VALID_CATEGORIES.includes(category)) {
      throw new Error(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }

    if (!location || !VALID_LOCATIONS.includes(location)) {
      throw new Error(`Location must be one of: ${VALID_LOCATIONS.join(', ')}`);
    }

    if (!role || !VALID_ROLES.includes(role)) {
      throw new Error(`Role must be one of: ${VALID_ROLES.join(', ')}`);
    }

    if (weekendPriority !== undefined) {
      if (weekendPriority < 1 || weekendPriority > 999 || !Number.isInteger(weekendPriority)) {
        throw new Error('Weekend priority must be between 1 and 999');
      }
    }

    // Check for duplicate number within same category
    const existing = await prisma.caddie.findFirst({
      where: { number, category }
    });
    if (existing) {
      throw new Error('A caddie with this number already exists in this category');
    }

    // Auto-calculate weekendPriority if not provided
    let calculatedWeekendPriority = weekendPriority;
    if (!calculatedWeekendPriority) {
      const lastCaddieInCategory = await prisma.caddie.findFirst({
        where: { category },
        orderBy: { weekendPriority: 'desc' },
        select: { weekendPriority: true }
      });

      calculatedWeekendPriority = (lastCaddieInCategory?.weekendPriority || 0) + 1;
    }

    // Create caddie
    const caddie = await prisma.caddie.create({
      data: {
        name,
        number,
        category,
        location,
        role,
        weekendPriority: calculatedWeekendPriority,
        status: 'AVAILABLE',
        isActive: true,
      },
    });

    // Create availability records if provided
    if (availability && Array.isArray(availability)) {
      for (const avail of availability) {
        await prisma.caddieAvailability.create({
          data: {
            caddieId: caddie.id,
            day: avail.day,
            isAvailable: avail.isAvailable !== false,
            rangeType: avail.range?.type || null,
            rangeTime: avail.range?.time || null,
            rangeEndTime: avail.range?.endTime || null,
          },
        });
      }
    }

    // Get caddie with availability
    const result = await prisma.caddie.findUnique({
      where: { id: caddie.id },
      include: { availability: true },
    });

    return this.formatCaddies([result])[0];
  }

  /**
   * Update a caddie
   */
  async updateCaddie(id, updates) {
    if (!updates) {
      throw new Error('Updates object is required');
    }

    const caddie = await prisma.caddie.findUnique({ where: { id } });
    if (!caddie) {
      throw new Error('Caddie not found');
    }

    const data = {};

    if (updates.name !== undefined) data.name = updates.name;
    if (updates.number !== undefined && data.number === undefined) {
      const existing = await prisma.caddie.findFirst({
        where: {
          number: updates.number,
          NOT: { id },
          category: updates.category || caddie.category
        },
      });
      if (existing) {
        throw new Error(`Caddie number ${updates.number} already exists in this category`);
      }
      data.number = updates.number;
    }
    if (updates.category !== undefined && updates.category !== caddie.category) {
      data.category = updates.category;

      const lastCaddieInCategory = await prisma.caddie.findFirst({
        where: { category: updates.category },
        orderBy: { number: 'desc' },
        select: { number: true }
      });

      const newNumber = (lastCaddieInCategory?.number || 0) + 1;
      data.number = newNumber;

      const lastPriorityInCategory = await prisma.caddie.findFirst({
        where: { category: updates.category },
        orderBy: { weekendPriority: 'desc' },
        select: { weekendPriority: true }
      });

      const newPriority = (lastPriorityInCategory?.weekendPriority || 0) + 1;

      if (updates.weekendPriority === undefined) {
        data.weekendPriority = newPriority;
      }
    }

    if (updates.location !== undefined) data.location = updates.location;
    if (updates.role !== undefined) data.role = updates.role;
    if (updates.weekendPriority !== undefined) {
      if (updates.weekendPriority < 1 || updates.weekendPriority > 999 || !Number.isInteger(updates.weekendPriority)) {
        throw new Error('Weekend priority must be between 1 and 999');
      }
      data.weekendPriority = updates.weekendPriority;
    }
    if (updates.isActive !== undefined) data.isActive = updates.isActive;
    if (updates.status !== undefined) {
      if (!VALID_STATUSES.includes(updates.status)) {
        throw new Error(`Status must be one of: ${VALID_STATUSES.join(', ')}`);
      }
      data.status = updates.status;
      data.lastActionTime = new Date();
    }

    const updatedCaddie = await prisma.caddie.update({
      where: { id },
      data,
    });

    // Update availability if provided
    if (updates.availability && Array.isArray(updates.availability)) {
      await prisma.caddieAvailability.deleteMany({ where: { caddieId: id } });

      for (const avail of updates.availability) {
        await prisma.caddieAvailability.create({
          data: {
            caddieId: id,
            day: avail.day,
            isAvailable: avail.isAvailable !== false,
            rangeType: avail.range?.type || null,
            rangeTime: avail.range?.time || null,
            rangeEndTime: avail.range?.endTime || null,
          },
        });
      }
    }

    const result = await prisma.caddie.findUnique({
      where: { id },
      include: { availability: true },
    });

    return {
      updated: this.formatCaddies([result])[0],
      previousStatus: caddie.status,
      numberReassigned: data.number !== caddie.number &&
                         data.number !== undefined &&
                         updates.category !== undefined &&
                         updates.category !== caddie.category
    };
  }

  /**
   * Update caddie status
   */
  async updateCaddieStatus(id, status) {
    if (!status || !VALID_STATUSES.includes(status)) {
      throw new Error(`Status must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const caddie = await prisma.caddie.findUnique({ where: { id } });
    if (!caddie) {
      throw new Error('Caddie not found');
    }

    const previousStatus = caddie.status;

    // Update caddie status
    const updatedCaddie = await prisma.caddie.update({
      where: { id },
      data: {
        status,
        lastActionTime: new Date(),
      },
    });

    // Log to dispatch history
    await prisma.dispatchHistory.create({
      data: {
        caddieId: id,
        previousStatus,
        newStatus: status,
        location: caddie.location,
      },
    });

    // Update counts based on status
    if (status === 'ABSENT') {
      await prisma.caddie.update({
        where: { id },
        data: { absencesCount: { increment: 1 } },
      });
    } else if (status === 'LATE') {
      await prisma.caddie.update({
        where: { id },
        data: { lateCount: { increment: 1 } },
      });
    } else if (status === 'ON_LEAVE') {
      await prisma.caddie.update({
        where: { id },
        data: { leaveCount: { increment: 1 } },
      });
    } else if (status === 'IN_FIELD' && previousStatus === 'IN_PREP') {
      await prisma.caddie.update({
        where: { id },
        data: { historyCount: { increment: 1 } },
      });
    }

    return {
      caddie: updatedCaddie,
      previousStatus,
    };
  }

  /**
   * Soft delete a caddie (set isActive = false)
   */
  async deleteCaddie(id) {
    const caddie = await prisma.caddie.findUnique({ where: { id } });
    if (!caddie) {
      throw new Error('Caddie not found');
    }

    await prisma.caddie.update({
      where: { id },
      data: { isActive: false },
    });

    return {
      id: caddie.id,
      category: caddie.category,
    };
  }
}

// Export singleton instance
export const caddieService = new CaddieService();
