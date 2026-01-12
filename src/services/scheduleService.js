import prisma from '../config/database.js';
import { VALID_DAYS, VALID_CATEGORIES, VALID_LOCATIONS } from '../validators/validators.js';

/**
 * ScheduleService - Handles weekly shifts and assignments
 */
export class ScheduleService {
  /**
   * Get all weekly shifts
   */
  async getShifts(filters = {}) {
    const { day, location } = filters;

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

    return shifts.map(shift => ({
      id: shift.id,
      day: shift.day,
      time: shift.time,
      location: shift.location,
      requirements: shift.requirements.map(r => ({
        category: r.category,
        count: r.count,
      })),
    }));
  }

  /**
   * Create a new shift
   */
  async createShift(data) {
    const { day, time, location, requirements } = data;

    if (!day || !time || !location) {
      throw new Error('Day, time, and location are required');
    }

    if (!VALID_DAYS.includes(day)) {
      throw new Error(`Day must be one of: ${VALID_DAYS.join(', ')}`);
    }

    if (!VALID_LOCATIONS.includes(location)) {
      throw new Error(`Location must be one of: ${VALID_LOCATIONS.join(', ')}`);
    }

    // Validate time format (HH:mm)
    if (!/^\d{2}:\d{2}$/.test(time)) {
      throw new Error('Time must be in HH:mm format');
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

    return {
      id: result.id,
      day: result.day,
      time: result.time,
      location: result.location,
      requirements: result.requirements.map(r => ({
        category: r.category,
        count: r.count,
      })),
    };
  }

  /**
   * Delete a shift and its requirements
   */
  async deleteShift(id) {
    const shift = await prisma.weeklyShift.findUnique({ where: { id } });
    if (!shift) {
      throw new Error('Shift not found');
    }

    await prisma.weeklyShift.delete({ where: { id } });

    return { message: 'Shift deleted successfully' };
  }

  /**
   * Get all weekly assignments
   */
  async getAssignments(filters = {}) {
    const { shiftId, day } = filters;

    const where = {};
    if (shiftId) where.shiftId = shiftId;

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

    return assignments.map(a => ({
      shiftId: a.shiftId,
      caddieId: a.caddieId,
      caddieName: a.caddieName,
      caddieNumber: a.caddieNumber,
      category: a.category,
      time: a.shift.time,
      day: a.shift.day,
    }));
  }

  /**
   * Generate weekly draw for a specific day using assignment algorithm
   */
  async generateSchedule(day, location = 'Llanogrande') {
    if (!day || !VALID_DAYS.includes(day)) {
      throw new Error(`Day must be one of: ${VALID_DAYS.join(', ')}`);
    }

    // 1. Get shifts for day, sorted by time
    const shifts = await prisma.weeklyShift.findMany({
      where: { day, location },
      include: { requirements: true },
      orderBy: { time: 'asc' },
    });

    if (shifts.length === 0) {
      throw new Error('No shifts configured for this day');
    }

    // 2. Get available pool of caddies
    const caddies = await prisma.caddie.findMany({
      where: {
        isActive: true,
        location,
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
        { isSkippedNextWeek: 'desc' },
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

    return {
      assignedCount,
      skippedCount,
      assignments: assignments.map(a => ({
        shiftId: a.shiftId,
        caddieId: a.caddieId,
        caddieName: a.caddieName,
        caddieNumber: a.caddieNumber,
        category: a.category,
      })),
    };
  }

  /**
   * Reset weekly schedule (clear all assignments)
   */
  async resetSchedule() {
    await prisma.weeklyAssignment.deleteMany({});

    return { message: 'Schedule reset successfully' };
  }
}

export const scheduleService = new ScheduleService();
