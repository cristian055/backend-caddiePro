import prisma from '../config/database.js';

export const getAllAttendance = async (req, res) => {
  try {
    const attendance = await prisma.attendance.findMany({
      orderBy: { date: 'desc' },
    });

    res.json(attendance);
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAttendanceById = async (req, res) => {
  try {
    const { id } = req.params;

    const attendance = await prisma.attendance.findUnique({
      where: { id },
      include: { caddie: true },
    });

    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    res.json(attendance);
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createAttendance = async (req, res) => {
  try {
    const { caddieId, caddieName, listNumber, date, status } = req.body;

    if (!caddieId || !date || !status) {
      return res.status(400).json({ error: 'CaddieId, date, and status are required' });
    }

    // Get caddie name if not provided
    let name = caddieName;
    let list = listNumber;
    if (!name || !list) {
      const caddie = await prisma.caddie.findUnique({ where: { id: caddieId } });
      if (!caddie) {
        return res.status(404).json({ error: 'Caddie not found' });
      }
      name = caddie.name;
      list = caddie.listNumber;
    }

    // Check if attendance already exists for this caddie on this date
    const existing = await prisma.attendance.findUnique({
      where: {
        caddieId_date: {
          caddieId,
          date: new Date(date),
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Attendance already recorded for this caddie on this date' });
    }

    const attendance = await prisma.attendance.create({
      data: {
        caddieId,
        caddieName: name,
        listNumber: parseInt(list),
        date: new Date(date),
        status,
        callTime: new Date(),
        arrivalTime: status === 'Presente' || status === 'Llegó tarde' ? new Date() : null,
      },
    });

    // Handle penalty for late arrival - move to end of queue
    if (status === 'Llegó tarde') {
      await moveCaddieToEndOfQueue(caddieId);
    }

    res.status(201).json(attendance);
  } catch (error) {
    console.error('Create attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, arrivalTime, turnsCount, endTime } = req.body;

    const attendance = await prisma.attendance.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(arrivalTime && { arrivalTime: new Date(arrivalTime) }),
        ...(turnsCount !== undefined && { turnsCount }),
        ...(endTime && { endTime: new Date(endTime) }),
      },
    });

    res.json(attendance);
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAttendanceByCaddie = async (req, res) => {
  try {
    const { caddieId } = req.params;

    const attendance = await prisma.attendance.findMany({
      where: { caddieId },
      orderBy: { date: 'desc' },
    });

    res.json(attendance);
  } catch (error) {
    console.error('Get attendance by caddie error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAttendanceByList = async (req, res) => {
  try {
    const { listNumber } = req.params;

    const attendance = await prisma.attendance.findMany({
      where: { listNumber: parseInt(listNumber) },
      orderBy: { date: 'desc' },
    });

    res.json(attendance);
  } catch (error) {
    console.error('Get attendance by list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAttendanceByDate = async (req, res) => {
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

    res.json(attendance);
  } catch (error) {
    console.error('Get attendance by date error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper function to move caddie to end of queue
async function moveCaddieToEndOfQueue(caddieId) {
  const queue = await prisma.caddieQueue.findUnique({ where: { caddieId } });
  if (!queue) return;

  const lastQueue = await prisma.caddieQueue.findFirst({
    where: { listNumber: queue.listNumber },
    orderBy: { position: 'desc' },
  });

  await prisma.caddieQueue.update({
    where: { caddieId },
    data: { position: lastQueue ? lastQueue.position + 1 : 1 },
  });
}
