import prisma from '../config/database.js';
import { emitCaddieStatusChanged } from '../utils/websocketEmitter.js';
import { VALID_ATTENDANCE_STATUSES } from '../validators/validators.js';

/**
 * AttendanceService - Handles daily attendance business logic
 */
export class AttendanceService {
  /**
   * Create or update daily attendance record
   */
  async createDailyAttendance(caddieId, date, status) {
    if (!caddieId || !date || !status) {
      throw new Error('caddieId, date, and status are required');
    }

    if (!VALID_ATTENDANCE_STATUSES.includes(status)) {
      throw new Error(`Status must be one of: ${VALID_ATTENDANCE_STATUSES.join(', ')}`);
    }

    const caddie = await prisma.caddie.findUnique({ where: { id: caddieId } });
    if (!caddie) {
      throw new Error('Caddie not found');
    }

    const dateStr = new Date(date).toISOString().split('T')[0];

    const existing = await prisma.dailyAttendance.findUnique({
      where: {
        caddieId_date: {
          caddieId,
          date: new Date(dateStr)
        }
      }
    });

    let attendance;
    if (existing) {
      attendance = await prisma.dailyAttendance.update({
        where: { id: existing.id },
        data: {
          status,
          arrivalTime: (status === 'PRESENT' || status === 'LATE') ? new Date() : existing.arrivalTime
        },
        include: { caddie: true }
      });
    } else {
      attendance = await prisma.dailyAttendance.create({
        data: {
          caddieId,
          date: new Date(dateStr),
          status,
          arrivalTime: (status === 'PRESENT' || status === 'LATE') ? new Date() : null
        },
        include: { caddie: true }
      });
    }

    const queuePosition = await prisma.queuePosition.findFirst({
      where: { caddieId }
    });

    const currentOperationalStatus = queuePosition?.operationalStatus || 'AVAILABLE';

    if (attendance && queuePosition) {
      emitCaddieStatusChanged({
        id: attendance.caddieId,
        name: caddie.name,
        number: caddie.number,
        category: caddie.category,
        previousStatus: currentOperationalStatus,
        newStatus: currentOperationalStatus,
        caddie: {
          id: caddie.id,
          name: caddie.name,
          number: caddie.number,
          category: caddie.category,
        },
      });
    }

    return attendance;
  }

  /**
   * Get daily attendance for a specific date
   */
  async getDailyAttendance(date) {
    const dateStr = new Date(date).toISOString().split('T')[0];

    const attendance = await prisma.dailyAttendance.findMany({
      where: {
        date: new Date(dateStr)
      },
      include: {
        caddie: {
          select: {
            id: true,
            name: true,
            number: true,
            category: true,
            location: true
          }
        }
      },
      orderBy: { caddie: { number: 'asc' } }
    });

    return {
      date: dateStr,
      attendance
    };
  }

  /**
   * Get daily attendance statistics
   */
  async getDailyAttendanceStats(date) {
    const dateStr = new Date(date).toISOString().split('T')[0];

    const attendance = await prisma.dailyAttendance.findMany({
      where: {
        date: new Date(dateStr)
      }
    });

    const stats = {
      total: attendance.length,
      present: attendance.filter(a => a.status === 'PRESENT').length,
      late: attendance.filter(a => a.status === 'LATE').length,
      absent: attendance.filter(a => a.status === 'ABSENT').length,
      onLeave: attendance.filter(a => a.status === 'ON_LEAVE').length,
      worked: attendance.filter(a => a.servicesCount > 0).length
    };

    return {
      date: dateStr,
      ...stats
    };
  }

  /**
   * Update daily attendance record
   */
  async updateDailyAttendance(id, updates) {
    const existing = await prisma.dailyAttendance.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('Attendance record not found');
    }

    const caddie = await prisma.caddie.findUnique({ where: { id: existing.caddieId } });

    const data = {};
    if (updates.status !== undefined) {
      if (!VALID_ATTENDANCE_STATUSES.includes(updates.status)) {
        throw new Error(`Status must be one of: ${VALID_ATTENDANCE_STATUSES.join(', ')}`);
      }
      data.status = updates.status;
    }
    if (updates.servicesCount !== undefined) data.servicesCount = updates.servicesCount;

    const attendance = await prisma.dailyAttendance.update({
      where: { id },
      data,
      include: { caddie: true }
    });

    const queuePosition = await prisma.queuePosition.findFirst({
      where: { caddieId: existing.caddieId }
    });

    const currentOperationalStatus = queuePosition?.operationalStatus || 'AVAILABLE';

    if (attendance && queuePosition) {
      emitCaddieStatusChanged({
        id: attendance.caddieId,
        name: caddie.name,
        number: caddie.number,
        category: caddie.category,
        previousStatus: currentOperationalStatus,
        newStatus: currentOperationalStatus,
        caddie: {
          id: caddie.id,
          name: caddie.name,
          number: caddie.number,
          category: caddie.category,
        },
      });
    }

    return attendance;
  }

  /**
   * Handle attendance when caddie status changes
   * Called from CaddieService to create/update attendance records
   */
  async handleAttendanceForStatusChange(caddieId, status) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAttendance = await prisma.dailyAttendance.findUnique({
      where: {
        caddieId_date: {
          caddieId,
          date: today
        }
      }
    });

    let attendance;
    if (existingAttendance) {
      attendance = await prisma.dailyAttendance.update({
        where: { id: existingAttendance.id },
        data: {
          status,
          arrivalTime: (status === 'PRESENT' || status === 'LATE') ? new Date() : existingAttendance.arrivalTime
        },
        include: { caddie: true }
      });
    } else {
      attendance = await prisma.dailyAttendance.create({
        data: {
          caddieId,
          date: today,
          status,
          arrivalTime: (status === 'PRESENT' || status === 'LATE') ? new Date() : null
        },
        include: { caddie: true }
      });
    }

    return attendance;
  }

  /**
   * Increment services count when caddie completes service
   */
  async incrementServicesCount(caddieId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAttendance = await prisma.dailyAttendance.findUnique({
      where: {
        caddieId_date: {
          caddieId,
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
          caddieId,
          date: today,
          status: 'PRESENT',
          arrivalTime: new Date(),
          servicesCount: 1
        },
        include: { caddie: true }
      });
    }

    return attendance;
  }
}

export const attendanceService = new AttendanceService();
