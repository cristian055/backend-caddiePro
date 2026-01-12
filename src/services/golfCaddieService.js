import prisma from '../config/database.js';
import { VALID_CATEGORIES as VALID_GOLF_CATEGORIES } from '../validators/validators.js';
import { emitCaddieUpdated, emitCaddieStatusChanged, emitDailyAttendanceUpdated } from '../utils/websocketEmitter.js';

/**
 * GolfCaddieService - Handles golf caddie business logic using new structure
 * Uses GolfList and GolfCaddieProfile tables for position management
 */
export class GolfCaddieService {
  /**
   * Get all golf caddies with optional filtering
   */
  async getAllGolfCaddies(filters = {}) {
    const { searchTerm, category, activeStatus, location, includeInactive } = filters;

    const where = {
      role: 'GOLF',
    };

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
      const categoryUpper = category.toUpperCase();
      if (VALID_GOLF_CATEGORIES.includes(categoryUpper)) {
        where.category = categoryUpper;
      }
    }

    // Filter by location
    if (location) {
      where.location = location.toUpperCase();
    }

    // Search by name or number
    if (searchTerm) {
      const searchNumber = parseInt(searchTerm);
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        ...(isNaN(searchNumber) ? [] : [{ number: searchNumber }]),
      ];
    }

    // Get caddies with golf profiles
    const caddies = await prisma.caddie.findMany({
      where,
      include: {
        golfProfile: true,
        availability: true,
      },
      orderBy: [
        { number: 'asc' },
      ],
    });

    return this.formatGolfCaddies(caddies);
  }

  /**
   * Format golf caddie data for API response
   */
  formatGolfCaddies(caddies) {
    return caddies.map(caddie => ({
      id: caddie.id,
      name: caddie.name,
      number: caddie.number,
      status: caddie.status,
      isActive: caddie.isActive,
      type: caddie.type,
      category: caddie.golfProfile?.category || null,
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
      // Include golf profile data if exists
      ...(caddie.golfProfile ? {
        golfProfile: {
          id: caddie.golfProfile.id,
          golfListId: caddie.golfProfile.golfListId,
          category: caddie.golfProfile.category,
          position: caddie.golfProfile.position,
          priority: caddie.golfProfile.priority,
          skipNext: caddie.golfProfile.skipNext,
          status: caddie.golfProfile.status,
          lastAssignedAt: caddie.golfProfile.lastAssignedAt,
        }
      } : {}),
    }));
  }

  /**
   * Get golf caddie by ID
   */
  async getGolfCaddieById(id) {
    const caddie = await prisma.caddie.findUnique({
      where: { id },
      include: {
        golfProfile: true,
        availability: true,
        dailyAttendances: true,
      },
    });

    if (!caddie) {
      return null;
    }

    const formatted = this.formatGolfCaddies([caddie])[0];

    // Include daily attendance data
    formatted.dailyAttendances = caddie.dailyAttendances.map(da => ({
      id: da.id,
      caddieId: da.caddieId,
      date: da.date,
      status: da.status,
      arrivalTime: da.arrivalTime,
      servicesCount: da.servicesCount,
    }));

    // Include dispatch history
    formatted.dispatchHistory = caddie.dispatchHistory.slice(0, 10);

    return formatted;
  }

  /**
   * Create a new golf caddie
   */
  async createGolfCaddie(data) {
    const { name, number, category, location, availability, weekendPriority } = data;

    // Validation
    if (!name || name.length < 2 || name.length > 100) {
      throw new Error('Name must be between 2 and 100 characters');
    }

    if (!number || number < 1 || number > 999) {
      throw new Error('Number must be between 1 and 999');
    }

    const categoryUpper = category?.toUpperCase();
    if (categoryUpper && !VALID_GOLF_CATEGORIES.includes(categoryUpper)) {
      throw new Error(`Category must be one of: ${VALID_GOLF_CATEGORIES.join(', ')}`);
    }

    if (!location) {
      throw new Error('Location is required');
    }

    const locationUpper = location.toUpperCase();
    if (locationUpper !== 'LLANOGRANDE' && locationUpper !== 'MEDELLIN') {
      throw new Error('Location must be one of: LLANOGRANDE, MEDELLIN');
    }

    if (weekendPriority !== undefined) {
      if (weekendPriority < 1 || weekendPriority > 999 || !Number.isInteger(weekendPriority)) {
        throw new Error('Weekend priority must be between 1 and 999');
      }
    }

    // Check for duplicate number within same category
    const existing = await prisma.caddie.findFirst({
      where: { number, category: categoryUpper, isActive: true },
    });

    if (existing) {
      throw new Error('A caddie with this number already exists in this category');
    }

    // Find corresponding Golf List
    const golfList = await prisma.golfList.findFirst({
      where: {
        category: categoryUpper,
        location: locationUpper,
        isActive: true,
      },
    });

    if (!golfList) {
      throw new Error('No Golf List configuration found for this category/location');
    }

    // Auto-calculate weekendPriority if not provided
    let calculatedWeekendPriority = weekendPriority;
    if (!calculatedWeekendPriority) {
      // Find last position in list
      const lastProfile = await prisma.golfCaddieProfile.findFirst({
        where: {
          golfListId: golfList.id,
          category: categoryUpper,
        },
        orderBy: { position: 'desc' },
      });

      const lastPosition = lastProfile ? lastProfile.position : '0';

      // Use integer calculation for new position
      calculatedWeekendPriority = parseInt(lastPosition, 10) + 1;
    }

    // Create caddie
    const caddie = await prisma.caddie.create({
      data: {
        name,
        number,
        type: 'GOLF',
        location: locationUpper,
        category: categoryUpper,
        role: 'GOLF',
        weekendPriority: calculatedWeekendPriority,
        isActive: true,
      },
    });

    // Create golf profile (position in list)
    const profile = await prisma.golfCaddieProfile.create({
      data: {
        caddieId: caddie.id,
        golfListId: golfList.id,
        category: categoryUpper,
        position: calculatedWeekendPriority.toString(),
        status: 'AVAILABLE',
        priority: calculatedWeekendPriority,
        skipNext: false,
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

    // Get caddie with profile for response
    const result = await this.getGolfCaddieById(caddie.id);

    emitCaddieAdded(result);

    return result;
  }

  /**
   * Update golf caddie (basic fields only)
   */
  async updateGolfCaddie(id, updates) {
    if (!updates) {
      throw new Error('Updates object is required');
    }

    const caddie = await prisma.caddie.findUnique({ where: { id } });
    if (!caddie) {
      throw new Error('Caddie not found');
    }

    const data = {};

    if (updates.name !== undefined) data.name = updates.name;
    if (updates.number !== undefined) {
      const existing = await prisma.caddie.findFirst({
        where: { number: updates.number, category: caddie.category, NOT: { id } },
      });
      if (existing) {
        throw new Error('A caddie with this number already exists');
      }
      data.number = updates.number;
    }
    if (updates.isActive !== undefined) data.isActive = updates.isActive;
    if (updates.category !== undefined) data.category = updates.category.toUpperCase();
    if (updates.location !== undefined) data.location = updates.location.toUpperCase();

    const updatedCaddie = await prisma.caddie.update({
      where: { id },
      data,
    });

    const result = await this.getGolfCaddieById(id);

    emitCaddieUpdated(id, updates, result.category);

    return {
      updated: this.formatGolfCaddies([updatedCaddie])[0],
      previousCategory: caddie.category,
    };
  }
}

/**
 * TennisCaddieService - Handles tennis caddie business logic using simple structure
 * Uses TennisCaddie table (no profiles or positions)
 */
export class TennisCaddieService {
  /**
   * Get all tennis caddies with optional filtering
   */
  async getAllTennisCaddies(filters = {}) {
    const { searchTerm, location, activeStatus, includeInactive } = filters;

    const where = {
      role: 'TENNIS',
    };

    // Filter by active status
    if (activeStatus === 'Active') {
      where.isActive = true;
    } else if (activeStatus === 'Inactive') {
      where.isActive = false;
    } else if (!includeInactive || includeInactive === 'false') {
      where.isActive = true;
    }

    // Filter by location
    if (location) {
      where.location = location.toUpperCase();
    }

    // Search by name or number
    if (searchTerm) {
      const searchNumber = parseInt(searchTerm);
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        ...(isNaN(searchNumber) ? [] : [{ number: searchNumber }]),
      ];
    }

    const caddies = await prisma.tennisCaddie.findMany({
      where,
      orderBy: [{ number: 'asc' }],
    });

    return caddies.map(caddie => ({
      id: caddie.id,
      name: caddie.name,
      number: caddie.number,
      status: caddie.status,
      isActive: caddie.isActive,
      type: caddie.type,
      location: caddie.location,
      courtPreference: caddie.courtPreference || null,
      lastAssignedAt: caddie.lastAssignedAt || null,
    }));
  }

  /**
   * Get tennis caddie by ID
   */
  async getTennisCaddieById(id) {
    const caddie = await prisma.tennisCaddie.findUnique({
      where: { id },
      include: {
        dailyAttendances: true,
      },
    });

    if (!caddie) {
      return null;
    }

    const formatted = this.formatTennisCaddies([caddie])[0];

    // Include daily attendance data
    formatted.dailyAttendances = caddie.dailyAttendances.map(da => ({
      id: da.id,
      caddieId: da.caddieId,
      date: da.date,
      status: da.status,
      arrivalTime: da.arrivalTime,
      servicesCount: da.servicesCount,
    }));

    return formatted;
  }

  /**
   * Update tennis caddie status
   */
  async updateTennisCaddieStatus(id, status) {
    if (!status || !['AVAILABLE', 'IN_PREP', 'IN_FIELD', 'LATE', 'ABSENT', 'ON_LEAVE'].includes(status)) {
      throw new Error(`Status must be one of: AVAILABLE, IN_PREP, IN_FIELD, LATE, ABSENT, ON_LEAVE`);
    }

    const caddie = await prisma.tennisCaddie.findUnique({ where: { id } });
    if (!caddie) {
      throw new Error('Caddie not found');
    }

    const previousStatus = caddie.status;

    // Update caddie status
    const updatedCaddie = await prisma.tennisCaddie.update({
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

    emitCaddieStatusChanged(updatedCaddie, previousStatus);

    return {
      caddie: updatedCaddie,
      previousStatus,
    };
  }
}

export const golfCaddieService = new GolfCaddieService();
export const tennisCaddieService = new TennisCaddieService();
