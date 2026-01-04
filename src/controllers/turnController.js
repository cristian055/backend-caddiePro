import prisma from '../config/database.js';

export const getAllTurns = async (req, res) => {
  try {
    const turns = await prisma.turn.findMany({
      orderBy: { startTime: 'desc' },
    });

    res.json(turns);
  } catch (error) {
    console.error('Get turns error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTurnById = async (req, res) => {
  try {
    const { id } = req.params;

    const turn = await prisma.turn.findUnique({
      where: { id },
      include: { caddie: true },
    });

    if (!turn) {
      return res.status(404).json({ error: 'Turn not found' });
    }

    res.json(turn);
  } catch (error) {
    console.error('Get turn error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTurn = async (req, res) => {
  try {
    const { caddieId, caddieName, listNumber } = req.body;

    if (!caddieId || !listNumber) {
      return res.status(400).json({ error: 'CaddieId and listNumber are required' });
    }

    // Get caddie name if not provided
    let name = caddieName;
    if (!name) {
      const caddie = await prisma.caddie.findUnique({ where: { id: caddieId } });
      if (!caddie) {
        return res.status(404).json({ error: 'Caddie not found' });
      }
      name = caddie.name;
    }

    // Create the turn
    const turn = await prisma.turn.create({
      data: {
        caddieId,
        caddieName: name,
        listNumber: parseInt(listNumber),
        completed: false,
      },
    });

    // Update caddie status
    await prisma.caddie.update({
      where: { id: caddieId },
      data: { status: 'En campo' },
    });

    // Remove from available queue
    await prisma.caddieQueue.update({
      where: { caddieId },
      data: { available: false },
    });

    res.status(201).json(turn);
  } catch (error) {
    console.error('Create turn error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTurn = async (req, res) => {
  try {
    const { id } = req.params;
    const { endTime, completed } = req.body;

    const turn = await prisma.turn.update({
      where: { id },
      data: {
        endTime: endTime ? new Date(endTime) : new Date(),
        completed: completed !== undefined ? completed : true,
      },
    });

    // Update caddie status back to available
    await prisma.caddie.update({
      where: { id: turn.caddieId },
      data: { status: 'Disponible' },
    });

    // Add back to queue at the end
    const listNumber = turn.listNumber;
    const lastQueue = await prisma.caddieQueue.findFirst({
      where: { listNumber },
      orderBy: { position: 'desc' },
    });

    await prisma.caddieQueue.update({
      where: { caddieId: turn.caddieId },
      data: {
        available: true,
        position: lastQueue ? lastQueue.position + 1 : 1,
      },
    });

    // Update attendance turns count for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendance.findFirst({
      where: {
        caddieId: turn.caddieId,
        date: today,
      },
    });

    if (attendance) {
      await prisma.attendance.update({
        where: { id: attendance.id },
        data: { turnsCount: { increment: 1 } },
      });
    }

    res.json(turn);
  } catch (error) {
    console.error('Update turn error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTurnsByCaddie = async (req, res) => {
  try {
    const { caddieId } = req.params;

    const turns = await prisma.turn.findMany({
      where: { caddieId },
      orderBy: { startTime: 'desc' },
    });

    res.json(turns);
  } catch (error) {
    console.error('Get turns by caddie error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTurnsByList = async (req, res) => {
  try {
    const { listNumber } = req.params;

    const turns = await prisma.turn.findMany({
      where: { listNumber: parseInt(listNumber) },
      orderBy: { startTime: 'desc' },
    });

    res.json(turns);
  } catch (error) {
    console.error('Get turns by list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTurnsByDate = async (req, res) => {
  try {
    const { date } = req.params;

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const turns = await prisma.turn.findMany({
      where: {
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { startTime: 'desc' },
    });

    res.json(turns);
  } catch (error) {
    console.error('Get turns by date error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
