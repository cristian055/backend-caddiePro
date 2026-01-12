import prisma from '../config/database.js';
import { createObjectCsvWriter } from 'csv-writer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * ReportsService - Handles statistics, reports, and CSV exports
 */
export class ReportsService {
  /**
   * Get daily statistics
   */
  async getStatistics(date) {
    const targetDate = date ? new Date(date) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    // Get aggregated stats from service logs for date
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

    return {
      date: dateStr,
      ...stats,
    };
  }

  /**
   * Get caddies with incidents
   */
  async getIncidents(limit = 10) {
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

    return caddies.map(c => ({
      id: c.id,
      number: c.number,
      name: c.name,
      absencesCount: c.absencesCount,
      leaveCount: c.leaveCount,
      lateCount: c.lateCount,
      total: c.absencesCount + c.leaveCount + c.lateCount,
    }));
  }

  /**
   * Download daily report as CSV
   */
  async downloadCsv(date) {
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

    return { filepath, filename };
  }

  /**
   * Get range report
   */
  async getRangeReport(startDate, endDate) {
    const serviceLogs = await prisma.serviceLog.findMany({
      where: {
        serviceDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      orderBy: { serviceDate: 'asc' },
    });

    return {
      startDate,
      endDate,
      records: serviceLogs,
    };
  }

  /**
   * Get daily attendance report
   */
  async getDailyAttendanceReport(date) {
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

    const stats = {
      worked: attendance.filter(a => a.servicesCount > 0).length,
      absent: attendance.filter(a => a.status === 'ABSENT').length,
      onLeave: attendance.filter(a => a.status === 'ON_LEAVE').length,
      late: attendance.filter(a => a.status === 'LATE').length,
      total: attendance.length
    };

    return {
      date: dateStr,
      stats,
      attendance
    };
  }

  /**
   * Close day - archive daily attendance to ServiceLog
   */
  async closeDay(date) {
    const dateStr = new Date(date).toISOString().split('T')[0];
    const serviceDate = new Date(dateStr);

    const attendance = await prisma.dailyAttendance.findMany({
      where: {
        date: serviceDate
      },
      include: {
        caddie: true
      }
    });

    let recordsProcessed = 0;
    for (const record of attendance) {
      const existingServiceLog = await prisma.serviceLog.findUnique({
        where: {
          caddieId_serviceDate: {
            caddieId: record.caddieId,
            serviceDate: serviceDate
          }
        }
      });

      if (existingServiceLog) {
        await prisma.serviceLog.update({
          where: { id: existingServiceLog.id },
          data: {
            servicesCount: record.servicesCount,
            absencesCount: record.status === 'ABSENT' ?1 : 0,
            leavesCount: record.status === 'ON_LEAVE' ?1 : 0,
            latesCount: record.status === 'LATE' ?1 : 0
          }
        });
      } else {
        await prisma.serviceLog.create({
          data: {
            caddieId: record.caddieId,
            serviceDate: serviceDate,
            servicesCount: record.servicesCount,
            absencesCount: record.status === 'ABSENT' ?1 : 0,
            leavesCount: record.status === 'ON_LEAVE' ?1 : 0,
            latesCount: record.status === 'LATE' ?1 : 0
          }
        });
      }
      recordsProcessed++;
    }

    return {
      message: 'Day closed successfully',
      data: {
        date: dateStr,
        recordsProcessed
      }
    };
  }
}

export const reportsService = new ReportsService();
