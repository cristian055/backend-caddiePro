import prisma from '../config/database.js';
import { emitCaddieAdded, emitCaddieUpdated, emitCaddieDeleted, emitCaddieStatusChanged, emitDailyAttendanceUpdated } from '../utils/websocketEmitter.js';

// Valid status values
const VALID_STATUSES = ['AVAILABLE', 'IN_PREP', 'IN_FIELD', 'LATE', 'ABSENT', 'ON_LEAVE'];
const VALID_CATEGORIES = ['Primera', 'Segunda', 'Tercera'];
const VALID_LOCATIONS = ['Llanogrande', 'Medellín'];
const VALID_ROLES = ['Golf', 'Tennis', 'Hybrid'];

// Map category to number for sorting/filtering
const CATEGORY_MAP = {
  'Primera': 1,
  'Segunda': 2,
  'Tercera': 3,
};

/**
 * GET /caddies
 * Get all caddies with optional filtering
 */
export const getAllCaddies = async (req, res) => {
  try {
    const { searchTerm, category, activeStatus, location, role, includeInactive } = req.query;

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

    // Format response according to API spec
    const formattedCaddies = caddies.map(caddie => ({
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

    res.json({
      success: true,
      data: {
        caddies: formattedCaddies,
        total: formattedCaddies.length,
      },
    });
  } catch (error) {
    console.error('Get caddies error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

/**
 * GET /caddies/statistics
 * Get caddie statistics
 */
export const getCaddieStatistics = async (req, res) => {
  try {
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

    res.json({
      success: true,
      data: {
        total,
        active,
        inactive: total - active,
        byStatus: statusCounts,
        byCategory: categoryCounts,
      },
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

/**
 * GET /caddies/queue
 * Get caddies for queue (active and available/late)
 */
export const getCaddiesQueue = async (req, res) => {
  try {
    const caddies = await prisma.caddie.findMany({
      where: {
        isActive: true,
        status: { in: ['AVAILABLE', 'LATE'] },
      },
      orderBy: [{ weekendPriority: 'asc' }, { number: 'asc' }],
    });

    res.json({
      success: true,
      data: {
        queueCaddies: caddies.map(c => ({
          id: c.id,
          name: c.name,
          number: c.number,
          status: c.status,
          category: c.category,
          weekendPriority: c.weekendPriority,
        })),
      },
    });
  } catch (error) {
    console.error('Get queue error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

/**
 * GET /caddies/returns
 * Get caddies that need to return (IN_PREP or IN_FIELD status)
 */
export const getCaddiesReturns = async (req, res) => {
  try {
    const caddies = await prisma.caddie.findMany({
      where: {
        isActive: true,
        status: { in: ['IN_PREP', 'IN_FIELD'] },
      },
      orderBy: [{ lastActionTime: 'asc' }],
    });

    res.json({
      success: true,
      data: {
        returnCaddies: caddies.map(c => ({
          id: c.id,
          name: c.name,
          number: c.number,
          status: c.status,
          category: c.category,
        })),
      },
    });
  } catch (error) {
    console.error('Get returns error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
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

    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    if (!validDays.includes(day)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid day' },
      });
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

    res.json({
      success: true,
      data: {
        day,
        availableCaddies: caddies.map(c => ({
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
        })),
      },
    });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
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
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Caddie not found' },
      });
    }

    res.json({
      success: true,
      data: {
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
      },
    });
  } catch (error) {
    console.error('Get caddie error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

/**
 * POST /caddies
 * Create a new caddie
 */
export const createCaddie = async (req, res) => {
  try {
    const { name, number, category, location, role, availability, weekendPriority } = req.body;

    // Validation
    if (!name || name.length < 2 || name.length > 100) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Name must be between 2 and 100 characters' },
      });
    }

    if (!number || number < 1 || number > 999) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Number must be between 1 and 999' },
      });
    }

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` },
      });
    }

    if (!location || !VALID_LOCATIONS.includes(location)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Location must be one of: ${VALID_LOCATIONS.join(', ')}` },
      });
    }

    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Role must be one of: ${VALID_ROLES.join(', ')}` },
      });
    }

    if (weekendPriority !== undefined) {
      if (weekendPriority < 1 || weekendPriority > 999 || !Number.isInteger(weekendPriority)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Weekend priority must be between 1 and 999' },
        });
      }
    }

    // Check for duplicate number within same category
    const existing = await prisma.caddie.findFirst({ 
      where: { number, category } 
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_ENTRY', message: 'A caddie with this number already exists in this category' },
      });
    }

    // Auto-calculate weekendPriority if not provided
    let calculatedWeekendPriority = weekendPriority;
    if (!calculatedWeekendPriority) {
      // Find the highest weekendPriority in the category
      const lastCaddieInCategory = await prisma.caddie.findFirst({
        where: { category },
        orderBy: { weekendPriority: 'desc' },
        select: { weekendPriority: true }
      });

      // New caddie becomes last in category
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

    emitCaddieAdded(result);

    res.status(201).json({
      success: true,
      data: {
        id: result.id,
        name: result.name,
        number: result.number,
        status: result.status,
        isActive: result.isActive,
        category: result.category,
        location: result.location,
        role: result.role,
        weekendPriority: result.weekendPriority,
        availability: result.availability.map(a => ({
          day: a.day,
          isAvailable: a.isAvailable,
          range: a.rangeType ? {
            type: a.rangeType,
            time: a.rangeTime,
            endTime: a.rangeEndTime,
          } : null,
        })),
      },
    });
  } catch (error) {
    console.error('Create caddie error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
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

    if (!updates) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Updates object is required' },
      });
    }

    const caddie = await prisma.caddie.findUnique({ where: { id } });
    if (!caddie) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Caddie not found' },
      });
    }

    const data = {};

    if (updates.name !== undefined) data.name = updates.name;
    if (updates.number !== undefined) {
      // Check for duplicate number
      const existing = await prisma.caddie.findFirst({
        where: { number: updates.number, NOT: { id } },
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          error: { code: 'DUPLICATE_ENTRY', message: 'A caddie with this number already exists' },
        });
      }
      data.number = updates.number;
    }
    if (updates.category !== undefined) {
      data.category = updates.category;

      // Auto-calculate weekendPriority when changing category
      // Caddie becomes last in new category
      const lastCaddieInCategory = await prisma.caddie.findFirst({
        where: { category: updates.category },
        orderBy: { weekendPriority: 'desc' },
        select: { weekendPriority: true }
      });

      const newPriority = (lastCaddieInCategory?.weekendPriority || 0) + 1;

      // Only auto-calculate if weekendPriority is not being explicitly set
      if (updates.weekendPriority === undefined) {
        data.weekendPriority = newPriority;
      }
    }

    if (updates.location !== undefined) data.location = updates.location;
    if (updates.role !== undefined) data.role = updates.role;
    if (updates.weekendPriority !== undefined) {
      if (updates.weekendPriority < 1 || updates.weekendPriority > 999 || !Number.isInteger(updates.weekendPriority)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Weekend priority must be between 1 and 999' },
        });
      }
      data.weekendPriority = updates.weekendPriority;
    }
    if (updates.isActive !== undefined) data.isActive = updates.isActive;
    if (updates.status !== undefined) {
      if (!VALID_STATUSES.includes(updates.status)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` },
        });
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
      // Delete existing availability
      await prisma.caddieAvailability.deleteMany({ where: { caddieId: id } });
      
      // Create new availability records
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

    // Create or update daily attendance record for attendance statuses
    if (updates.status !== undefined && updates.status !== caddie.status) {
      const attendanceStatuses = ['ABSENT', 'ON_LEAVE', 'LATE'];
      if (attendanceStatuses.includes(updates.status)) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existingAttendance = await prisma.dailyAttendance.findUnique({
          where: {
            caddieId_date: {
              caddieId: id,
              date: today
            }
          }
        });

        let attendance;
        if (existingAttendance) {
          attendance = await prisma.dailyAttendance.update({
            where: { id: existingAttendance.id },
            data: { status: updates.status, arrivalTime: updates.status === 'LATE' ? new Date() : existingAttendance.arrivalTime },
            include: { caddie: true }
          });
        } else {
          attendance = await prisma.dailyAttendance.create({
            data: {
              caddieId: id,
              date: today,
              status: updates.status,
              arrivalTime: updates.status === 'LATE' ? new Date() : null
            },
            include: { caddie: true }
          });
        }
        emitDailyAttendanceUpdated(attendance);
      }
    }

    // Emit general update event
    emitCaddieUpdated(id, updates, caddie.category);
    
    // If status was updated, also emit status changed event for real-time monitors
    if (updates.status !== undefined && updates.status !== caddie.status) {
      emitCaddieStatusChanged(result, caddie.status);
    }

    res.json({
      success: true,
      data: {
        id: result.id,
        name: result.name,
        number: result.number,
        status: result.status,
        isActive: result.isActive,
        category: result.category,
        location: result.location,
        role: result.role,
        weekendPriority: result.weekendPriority,
        availability: result.availability.map(a => ({
          day: a.day,
          isAvailable: a.isAvailable,
          range: a.rangeType ? {
            type: a.rangeType,
            time: a.rangeTime,
            endTime: a.rangeEndTime,
          } : null,
        })),
      },
    });
  } catch (error) {
    console.error('Update caddie error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
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

    const caddie = await prisma.caddie.findUnique({ where: { id } });
    if (!caddie) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Caddie not found' },
      });
    }

    await prisma.caddie.update({
      where: { id },
      data: { isActive: false },
    });

    emitCaddieDeleted(id, caddie.category);

    res.json({
      success: true,
      message: 'Caddie deactivated successfully',
    });
  } catch (error) {
    console.error('Delete caddie error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

/**
 * PATCH /caddies/:id/status
 * Update caddie status
 */
export const updateCaddieStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Status must be one of: ${VALID_STATUSES.join(', ')}` },
      });
    }

    const caddie = await prisma.caddie.findUnique({ where: { id } });
    if (!caddie) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Caddie not found' },
      });
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
        data: { lateCount: { increment:1 } },
      });
    } else if (status === 'ON_LEAVE') {
      await prisma.caddie.update({
        where: { id },
        data: { leaveCount: { increment:1 } },
      });
    } else if (status === 'IN_FIELD' && previousStatus === 'IN_PREP') {
      await prisma.caddie.update({
        where: { id },
        data: { historyCount: { increment:1 } },
      });
    }

    // Update daily attendance services count when caddie completes a service
    if (status === 'IN_FIELD' && previousStatus === 'IN_PREP') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existingAttendance = await prisma.dailyAttendance.findUnique({
        where: {
          caddieId_date: {
            caddieId: id,
            date: today
          }
        }
      });
      let attendance;
      if (existingAttendance) {
        attendance = await prisma.dailyAttendance.update({
          where: { id: existingAttendance.id },
          data: { servicesCount: { increment: 1 } },
          include: { caddie: true }
        });
      } else {
        attendance = await prisma.dailyAttendance.create({
          data: {
            caddieId: id,
            date: today,
            status: 'PRESENT',
            arrivalTime: new Date(),
            servicesCount: 1
          },
          include: { caddie: true }
        });
      }
      emitDailyAttendanceUpdated(attendance);
    }

    // Create or update daily attendance record for attendance statuses
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Handle IN_PREP - create PRESENT attendance when caddie goes to work
    if (status === 'IN_PREP') {
      const existingAttendance = await prisma.dailyAttendance.findUnique({
        where: {
          caddieId_date: {
            caddieId: id,
            date: today
          }
        }
      });

      let attendance;
      if (existingAttendance) {
        attendance = await prisma.dailyAttendance.update({
          where: { id: existingAttendance.id },
          data: { status: 'PRESENT', arrivalTime: new Date() },
          include: { caddie: true }
        });
      } else {
        attendance = await prisma.dailyAttendance.create({
          data: {
            caddieId: id,
            date: today,
            status: 'PRESENT',
            arrivalTime: new Date()
          },
          include: { caddie: true }
        });
      }
      emitDailyAttendanceUpdated(attendance);
    }

    const attendanceStatuses = ['ABSENT', 'ON_LEAVE'];
    if (attendanceStatuses.includes(status)) {
      const existingAttendance = await prisma.dailyAttendance.findUnique({
        where: {
          caddieId_date: {
            caddieId: id,
            date: today
          }
        }
      });

      let attendance;
      if (existingAttendance) {
        attendance = await prisma.dailyAttendance.update({
          where: { id: existingAttendance.id },
          data: { status },
          include: { caddie: true }
        });
      } else {
        attendance = await prisma.dailyAttendance.create({
          data: {
            caddieId: id,
            date: today,
            status
          },
          include: { caddie: true }
        });
      }
      emitDailyAttendanceUpdated(attendance);
    } else if (status === 'LATE') {
      const existingAttendance = await prisma.dailyAttendance.findUnique({
        where: {
          caddieId_date: {
            caddieId: id,
            date: today
          }
        }
      });

      let attendance;
      if (existingAttendance) {
        attendance = await prisma.dailyAttendance.update({
          where: { id: existingAttendance.id },
          data: { status: 'LATE', arrivalTime: new Date() },
          include: { caddie: true }
        });
      } else {
        attendance = await prisma.dailyAttendance.create({
          data: {
            caddieId: id,
            date: today,
            status: 'LATE',
            arrivalTime: new Date()
          },
          include: { caddie: true }
        });
      }
      emitDailyAttendanceUpdated(attendance);
    }

    emitCaddieStatusChanged(updatedCaddie, previousStatus);

    res.json({
      success: true,
      data: {
        id: updatedCaddie.id,
        name: updatedCaddie.name,
        number: updatedCaddie.number,
        status: updatedCaddie.status,
        previousStatus,
      },
    });
  } catch (error) {
    console.error('Update caddie status error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

// ============================================
// Legacy support functions (for backward compatibility)
// ============================================

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

    const caddies = await prisma.caddie.findMany({
      where: { category, isActive: true },
      orderBy: [{ number: 'asc' }],
    });

    res.json({
      success: true,
      data: { caddies },
    });
  } catch (error) {
    console.error('Get caddies by list error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};
