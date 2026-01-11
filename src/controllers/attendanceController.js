import prisma from '../config/database.js';
import { emitDailyAttendanceUpdated } from '../utils/websocketEmitter.js';

const VALID_ATTENDANCE_STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE'];

export const createDailyAttendance = async (req, res) => {
  try {
    const { caddieId, date, status } = req.body;

    if (!caddieId || !date || !status) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'caddieId, date, and status are required' }
      });
    }

    if (!VALID_ATTENDANCE_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Status must be one of: ${VALID_ATTENDANCE_STATUSES.join(', ')}` }
      });
    }

    const caddie = await prisma.caddie.findUnique({ where: { id: caddieId } });
    if (!caddie) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Caddie not found' }
      });
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

    emitDailyAttendanceUpdated(attendance);

    res.status(existing ? 200 : 201).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    console.error('Create daily attendance error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
};

export const getDailyAttendance = async (req, res) => {
  try {
    const { date } = req.params;
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

    res.json({
      success: true,
      data: {
        date: dateStr,
        attendance
      }
    });
  } catch (error) {
    console.error('Get daily attendance error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
};

export const getDailyAttendanceStats = async (req, res) => {
  try {
    const { date } = req.params;
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

    res.json({
      success: true,
      data: {
        date: dateStr,
        ...stats
      }
    });
  } catch (error) {
    console.error('Get daily attendance stats error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
};

export const updateDailyAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, servicesCount } = req.body;

    const existing = await prisma.dailyAttendance.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Attendance record not found' }
      });
    }

    const data = {};
    if (status !== undefined) {
      if (!VALID_ATTENDANCE_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: `Status must be one of: ${VALID_ATTENDANCE_STATUSES.join(', ')}` }
        });
      }
      data.status = status;
    }
    if (servicesCount !== undefined) data.servicesCount = servicesCount;

    const attendance = await prisma.dailyAttendance.update({
      where: { id },
      data,
      include: { caddie: true }
    });

    emitDailyAttendanceUpdated(attendance);

    res.json({
      success: true,
      data: attendance
    });
  } catch (error) {
    console.error('Update daily attendance error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    });
  }
};
