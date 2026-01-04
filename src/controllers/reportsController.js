import prisma from '../config/database.js';
import { createObjectCsvWriter } from 'csv-writer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const getDailyReport = async (req, res) => {
  try {
    const { date } = req.params;

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const attendance = await prisma.attendance.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { listNumber: 'asc' },
    });

    // Calculate summary
    const summary = {
      totalCaddies: attendance.length,
      present: attendance.filter((a) => a.status === 'Presente').length,
      late: attendance.filter((a) => a.status === 'Llegó tarde').length,
      absent: attendance.filter((a) => a.status === 'No vino').length,
      permission: attendance.filter((a) => a.status === 'Permiso').length,
      totalTurns: attendance.reduce((sum, a) => sum + a.turnsCount, 0),
    };

    res.json({ date, records: attendance, summary });
  } catch (error) {
    console.error('Get daily report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getRangeReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.params;

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const attendance = await prisma.attendance.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { date: 'asc' },
    });

    res.json({ startDate, endDate, records: attendance });
  } catch (error) {
    console.error('Get range report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const downloadCsvReport = async (req, res) => {
  try {
    const { date } = req.params;

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const attendance = await prisma.attendance.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        caddie: {
          select: {
            listNumber: true,
          },
        },
      },
      orderBy: { listNumber: 'asc' },
    });

    const filename = `report_${date}.csv`;
    const filepath = join(__dirname, '../../tmp', filename);

    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: [
        { id: 'date', title: 'Fecha' },
        { id: 'name', title: 'Nombre Caddie' },
        { id: 'listNumber', title: 'Lista' },
        { id: 'status', title: 'Estado' },
        { id: 'callTime', title: 'Hora Llamado' },
        { id: 'arrivalTime', title: 'Hora Llegada' },
        { id: 'turnsCount', title: 'Turnos Realizados' },
        { id: 'endTime', title: 'Hora Salida' },
      ],
    });

    const records = attendance.map((a) => ({
      date: a.date.toISOString().split('T')[0],
      name: a.caddieName,
      listNumber: a.listNumber,
      status: a.status,
      callTime: a.callTime ? a.callTime.toISOString() : '',
      arrivalTime: a.arrivalTime ? a.arrivalTime.toISOString() : '',
      turnsCount: a.turnsCount,
      endTime: a.endTime ? a.endTime.toISOString() : '',
    }));

    await csvWriter.writeRecords(records);

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('CSV download error:', err);
      }
    });
  } catch (error) {
    console.error('Download CSV report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
