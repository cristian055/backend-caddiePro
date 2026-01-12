import { attendanceService } from '../services/attendanceService.js';
import { emitDailyAttendanceUpdated } from '../utils/websocketEmitter.js';

export const createDailyAttendance = async (req, res) => {
  try {
    const { caddieId, date, status } = req.body;
    const attendance = await attendanceService.createDailyAttendance(caddieId, date, status);
    emitDailyAttendanceUpdated(attendance);
    res.status(attendance.existed ? 200 : 201).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    console.error('Create daily attendance error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
};

export const getDailyAttendance = async (req, res) => {
  try {
    const { date } = req.params;
    const result = await attendanceService.getDailyAttendance(date);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get daily attendance error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
};

export const getDailyAttendanceStats = async (req, res) => {
  try {
    const { date } = req.params;
    const stats = await attendanceService.getDailyAttendanceStats(date);
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get daily attendance stats error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
};

export const updateDailyAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, servicesCount } = req.body;
    const attendance = await attendanceService.updateDailyAttendance(id, { status, servicesCount });
    emitDailyAttendanceUpdated(attendance);
    res.json({
      success: true,
      data: attendance
    });
  } catch (error) {
    console.error('Update daily attendance error:', error);
    const statusCode = error.message.includes('not found') ? 404 :
                     error.message.includes('must be') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: statusCode === 404 ? 'NOT_FOUND' : statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
};
