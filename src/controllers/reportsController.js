import prisma from '../config/database.js';
import { createObjectCsvWriter } from 'csv-writer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * GET /reports/statistics
 * Get daily statistics
 */
export const getStatistics = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    // Get aggregated stats from service logs for the date
    const serviceLogs = await prisma.serviceLog.findMany({
      where: {
        serviceDate: new Date(dateStr),
      },
    });

    const stats = serviceLogs.reduce(
      (acc, log) => ({
        totalServices: acc.totalServices + log.servicesCount,
        totalAbsences: acc.totalAbsences + log.absencesCount,
        totalLeaves: acc.totalLeaves + log.leavesCount,
        totalLates: acc.totalLates + log.latesCount,
      }),
      { totalServices: 0, totalAbsences: 0, totalLeaves: 0, totalLates: 0 }
    );

    // If no service logs, get from caddie counts
    if (serviceLogs.length === 0) {
      const caddies = await prisma.caddie.findMany({
        where: { isActive: true },
        select: {
          historyCount: true,
          absencesCount: true,
          leaveCount: true,
          lateCount: true,
        },
      });

      stats.totalServices = caddies.reduce((sum, c) => sum + c.historyCount, 0);
      stats.totalAbsences = caddies.reduce((sum, c) => sum + c.absencesCount, 0);
      stats.totalLeaves = caddies.reduce((sum, c) => sum + c.leaveCount, 0);
      stats.totalLates = caddies.reduce((sum, c) => sum + c.lateCount, 0);
    }

    res.json({
      success: true,
      data: {
        date: dateStr,
        ...stats,
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
 * GET /reports/incidents
 * Get caddies with incidents (absences, leaves, lates)
 */
export const getIncidents = async (req, res) => {
  try {
    const { limit } = req.query;
    const take = parseInt(limit) || 10;

    const caddies = await prisma.caddie.findMany({
      where: {
        isActive: true,
        OR: [
          { absencesCount: { gt: 0 } },
          { leaveCount: { gt: 0 } },
          { lateCount: { gt: 0 } },
        ],
      },
      orderBy: [
        { absencesCount: 'desc' },
        { lateCount: 'desc' },
        { leaveCount: 'desc' },
      ],
      take,
    });

    const incidents = caddies.map(c => ({
      id: c.id,
      number: c.number,
      name: c.name,
      absencesCount: c.absencesCount,
      leaveCount: c.leaveCount,
      lateCount: c.lateCount,
      total: c.absencesCount + c.leaveCount + c.lateCount,
    }));

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
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

/**
 * GET /reports/csv
 * Download daily report as CSV
 */
export const downloadCsv = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const caddies = await prisma.caddie.findMany({
      where: { isActive: true },
      orderBy: [{ number: 'asc' }],
    });

    const filename = `report_${targetDate}.csv`;
    const tmpDir = join(__dirname, '../../tmp');
    
    // Ensure tmp directory exists
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    const filepath = join(tmpDir, filename);

    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: [
        { id: 'number', title: 'Number' },
        { id: 'name', title: 'Name' },
        { id: 'category', title: 'Category' },
        { id: 'status', title: 'Current Status' },
        { id: 'historyCount', title: 'Today Services' },
        { id: 'absencesCount', title: 'Absences' },
        { id: 'leaveCount', title: 'Leaves' },
        { id: 'lateCount', title: 'Delays' },
      ],
    });

    const records = caddies.map(c => ({
      number: c.number,
      name: c.name,
      category: c.category || '',
      status: c.status,
      historyCount: c.historyCount,
      absencesCount: c.absencesCount,
      leaveCount: c.leaveCount,
      lateCount: c.lateCount,
    }));

    await csvWriter.writeRecords(records);

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
      // Clean up file after download
      fs.unlink(filepath, () => {});
    });
  } catch (error) {
    console.error('Download CSV error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

// ============================================
// Legacy support functions
// ============================================

export const getDailyReport = async (req, res) => {
  const { date } = req.params;
  req.query.date = date;
  return getStatistics(req, res);
};

export const getRangeReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.params;

    const serviceLogs = await prisma.serviceLog.findMany({
      where: {
        serviceDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      orderBy: { serviceDate: 'asc' },
    });

    res.json({
      success: true,
      data: {
        startDate,
        endDate,
        records: serviceLogs,
      },
    });
  } catch (error) {
    console.error('Get range report error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

export const downloadCsvReport = downloadCsv;
