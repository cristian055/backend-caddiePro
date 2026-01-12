import { reportsService } from '../services/reportsService.js';

export const getStatistics = async (req, res) => {
  try {
    const { date } = req.query;
    const stats = await reportsService.getStatistics(date);
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
};

export const getIncidents = async (req, res) => {
  try {
    const { limit } = req.query;
    const incidents = await reportsService.getIncidents(limit);
    res.json({
      success: true,
      data: {
        incidents,
      },
    });
  } catch (error) {
    console.error('Get incidents error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
};

export const downloadCsv = async (req, res) => {
  try {
    const { date } = req.query;
    const { filepath } = await reportsService.downloadCsv(date);
    res.download(filepath, `report_${date || new Date().toISOString().split('T')[0]}.csv`, (err) => {
      if (err) console.error('Download error:', err);
    });
  } catch (error) {
    console.error('Download CSV error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
};

// Legacy support functions
export const getDailyReport = async (req, res) => {
  const { date } = req.params;
  req.query.date = date;
  return getStatistics(req, res);
};

export const getRangeReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    const result = await reportsService.getRangeReport(startDate, endDate);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Get range report error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
};

export const downloadCsvReport = downloadCsv;

export const getDailyAttendanceReport = async (req, res) => {
  try {
    const { date } = req.params;
    const result = await reportsService.getDailyAttendanceReport(date);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get daily attendance report error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
};

export const closeDay = async (req, res) => {
  try {
    const { date } = req.params;
    const result = await reportsService.closeDay(date);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Close day error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
};
