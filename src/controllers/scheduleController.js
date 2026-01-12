import { scheduleService } from '../services/scheduleService.js';
import { emitScheduleUpdated } from '../utils/websocketEmitter.js';

export const getShifts = async (req, res) => {
  try {
    const { day, location } = req.query;
    const shifts = await scheduleService.getShifts({ day, location });
    res.json({
      success: true,
      data: {
        shifts: shifts,
      },
    });
  } catch (error) {
    console.error('Get shifts error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
};

export const createShift = async (req, res) => {
  try {
    const result = await scheduleService.createShift(req.body);
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Create shift error:', error);
    const statusCode = error.message.includes('must be') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
};

export const deleteShift = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await scheduleService.deleteShift(id);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Delete shift error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
};

export const getAssignments = async (req, res) => {
  try {
    const { shiftId, day } = req.query;
    const assignments = await scheduleService.getAssignments({ shiftId, day });
    res.json({
      success: true,
      data: {
        assignments: assignments,
      },
    });
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
};

export const generateSchedule = async (req, res) => {
  try {
    const { day, location } = req.body;
    const result = await scheduleService.generateSchedule(day, location);
    emitScheduleUpdated(day);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Generate schedule error:', error);
    const statusCode = error.message.includes('must be') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
};

export const resetSchedule = async (req, res) => {
  try {
    const result = await scheduleService.resetSchedule();
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Reset schedule error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
};
