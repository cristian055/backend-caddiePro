import prisma from '../config/database.js';
import { emitScheduleUpdated } from '../utils/websocketEmitter.js';

const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const VALID_CATEGORIES = ['Primera', 'Segunda', 'Tercera'];
const VALID_LOCATIONS = ['Llanogrande', 'Medellín'];

/**
 * GET /schedule/shifts
 * Get all weekly shifts
 */
export const getShifts = async (req, res) => {
  try {
    const { day, location } = req.query;

    const where = {};
    if (day) where.day = day;
    if (location) where.location = location;

    const shifts = await prisma.weeklyShift.findMany({
      where,
      include: {
        requirements: true,
      },
      orderBy: [{ day: 'asc' }, { time: 'asc' }],
    });

    res.json({
      success: true,
      data: {
        shifts: shifts.map(shift => ({
          id: shift.id,
          day: shift.day,
          time: shift.time,
          location: shift.location,
          requirements: shift.requirements.map(r => ({
            category: r.category,
            count: r.count,
          })),
        })),
      },
    });
  } catch (error) {
    console.error('Get shifts error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

/**
 * POST /schedule/shifts
 * Create a new shift
 */
export const createShift = async (req, res) => {
  try {
    const { day, time, location, requirements } = req.body;

    // Validation
    if (!day || !time || !location) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Day, time, and location are required' },
      });
    }

    if (!VALID_DAYS.includes(day)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Day must be one of: ${VALID_DAYS.join(', ')}` },
      });
    }

    if (!VALID_LOCATIONS.includes(location)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Location must be one of: ${VALID_LOCATIONS.join(', ')}` },
      });
    }

    // Validate time format (HH:mm)
    if (!/^\d{2}:\d{2}$/.test(time)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Time must be in HH:mm format' },
      });
    }

    const shift = await prisma.weeklyShift.create({
      data: {
        day,
        time,
        location,
      },
    });

    // Create requirements if provided
    if (requirements && Array.isArray(requirements)) {
      for (const req of requirements) {
        if (VALID_CATEGORIES.includes(req.category) && req.count > 0) {
          await prisma.weeklyShiftRequirement.create({
            data: {
              shiftId: shift.id,
              category: req.category,
              count: req.count,
            },
          });
        }
      }
    }

    const result = await prisma.weeklyShift.findUnique({
      where: { id: shift.id },
      include: { requirements: true },
    });

    res.status(201).json({
      success: true,
      data: {
        id: result.id,
        day: result.day,
        time: result.time,
        location: result.location,
        requirements: result.requirements.map(r => ({
          category: r.category,
          count: r.count,
        })),
      },
    });
  } catch (error) {
    console.error('Create shift error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

/**
 * DELETE /schedule/shifts/:id
 * Delete a shift and its requirements
 */
export const deleteShift = async (req, res) => {
  try {
    const { id } = req.params;

    const shift = await prisma.weeklyShift.findUnique({ where: { id } });
    if (!shift) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Shift not found' },
      });
    }

    // Delete shift (cascade will delete requirements and assignments)
    await prisma.weeklyShift.delete({ where: { id } });

    res.json({
      success: true,
      message: 'Shift deleted successfully',
    });
  } catch (error) {
    console.error('Delete shift error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

/**
 * GET /schedule/assignments
 * Get all weekly assignments
 */
export const getAssignments = async (req, res) => {
  try {
    const { shiftId, day } = req.query;

    const where = {};
    if (shiftId) where.shiftId = shiftId;

    // If filtering by day, get shifts for that day first
    let shiftIds = null;
    if (day) {
      const shifts = await prisma.weeklyShift.findMany({
        where: { day },
        select: { id: true },
      });
      shiftIds = shifts.map(s => s.id);
      where.shiftId = { in: shiftIds };
    }

    const assignments = await prisma.weeklyAssignment.findMany({
      where,
      include: {
        shift: true,
      },
      orderBy: [{ assignedAt: 'asc' }],
    });

    res.json({
      success: true,
      data: {
        assignments: assignments.map(a => ({
          shiftId: a.shiftId,
          caddieId: a.caddieId,
          caddieName: a.caddieName,
          caddieNumber: a.caddieNumber,
          category: a.category,
          time: a.shift.time,
          day: a.shift.day,
        })),
      },
    });
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

/**
 * POST /schedule/generate
 * Generate weekly draw for a specific day using the assignment algorithm
 */
export const generateSchedule = async (req, res) => {
  try {
    const { day, location } = req.body;

    if (!day || !VALID_DAYS.includes(day)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Day must be one of: ${VALID_DAYS.join(', ')}` },
      });
    }

    const loc = location || 'Llanogrande';

    // 1. Get shifts for the day, sorted by time
    const shifts = await prisma.weeklyShift.findMany({
      where: { day, location: loc },
      include: { requirements: true },
      orderBy: { time: 'asc' },
    });

    if (shifts.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'No shifts configured for this day' },
      });
    }

    // 2. Get available pool of caddies
    const caddies = await prisma.caddie.findMany({
      where: {
        isActive: true,
        location: loc,
        availability: {
          some: {
            day,
            isAvailable: true,
          },
        },
      },
      include: {
        availability: {
          where: { day },
        },
      },
      orderBy: [
        { isSkippedNextWeek: 'desc' }, // Priority to skipped caddies
        { weekendPriority: 'asc' },
      ],
    });

    // 3. Clear existing assignments for these shifts
    for (const shift of shifts) {
      await prisma.weeklyAssignment.deleteMany({
        where: { shiftId: shift.id },
      });
    }

    // 4. Assign caddies
    const assignedCaddieIds = new Set();
    const assignments = [];
    let assignedCount = 0;

    for (const shift of shifts) {
      for (const requirement of shift.requirements) {
        const { category, count } = requirement;
        let assigned = 0;

        for (const caddie of caddies) {
          if (assigned >= count) break;
          if (assignedCaddieIds.has(caddie.id)) continue;
          if (caddie.category !== category) continue;

          // Check time availability
          const avail = caddie.availability[0];
          if (avail) {
            const shiftTime = shift.time;
            if (avail.rangeType === 'before' && avail.rangeTime && shiftTime >= avail.rangeTime) continue;
            if (avail.rangeType === 'after' && avail.rangeTime && shiftTime < avail.rangeTime) continue;
            if (avail.rangeType === 'between' && avail.rangeTime && avail.rangeEndTime) {
              if (shiftTime < avail.rangeTime || shiftTime > avail.rangeEndTime) continue;
            }
          }

          // Assign caddie
          const assignment = await prisma.weeklyAssignment.create({
            data: {
              shiftId: shift.id,
              caddieId: caddie.id,
              caddieName: caddie.name,
              caddieNumber: caddie.number,
              category: caddie.category,
            },
          });

          assignedCaddieIds.add(caddie.id);
          assignments.push(assignment);
          assigned++;
          assignedCount++;
        }
      }
    }

    // 5. Update skip status
    const allCaddieIds = caddies.map(c => c.id);
    const skippedCount = allCaddieIds.length - assignedCaddieIds.size;

    // Reset assigned caddies
    await prisma.caddie.updateMany({
      where: { id: { in: [...assignedCaddieIds] } },
      data: { isSkippedNextWeek: false },
    });

    // Mark unassigned for next week priority
    const unassignedIds = allCaddieIds.filter(id => !assignedCaddieIds.has(id));
    if (unassignedIds.length > 0) {
      await prisma.caddie.updateMany({
        where: { id: { in: unassignedIds } },
        data: { isSkippedNextWeek: true },
      });
    }

    // Emit schedule update
    emitScheduleUpdated(day);

    res.json({
      success: true,
      data: {
        assignedCount,
        skippedCount,
        assignments: assignments.map(a => ({
          shiftId: a.shiftId,
          caddieId: a.caddieId,
          caddieName: a.caddieName,
          caddieNumber: a.caddieNumber,
          category: a.category,
        })),
      },
    });
  } catch (error) {
    console.error('Generate schedule error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

/**
 * POST /schedule/reset
 * Reset weekly schedule (clear all assignments)
 */
export const resetSchedule = async (req, res) => {
  try {
    await prisma.weeklyAssignment.deleteMany({});

    res.json({
      success: true,
      message: 'Schedule reset successfully',
    });
  } catch (error) {
    console.error('Reset schedule error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};
