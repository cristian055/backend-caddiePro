import prisma from '../config/database.js';

export const getAllListSettings = async (req, res) => {
  try {
    const settings = await prisma.listSettings.findMany({
      orderBy: { listNumber: 'asc' },
    });

    res.json(settings);
  } catch (error) {
    console.error('Get list settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getListSettings = async (req, res) => {
  try {
    const { listNumber } = req.params;

    const settings = await prisma.listSettings.findUnique({
      where: { listNumber: parseInt(listNumber) },
    });

    if (!settings) {
      return res.status(404).json({ error: 'List settings not found' });
    }

    res.json(settings);
  } catch (error) {
    console.error('Get list settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateListSettings = async (req, res) => {
  try {
    const { listNumber } = req.params;
    const { callTime, order, rangeStart, rangeEnd } = req.body;

    const settings = await prisma.listSettings.upsert({
      where: { listNumber: parseInt(listNumber) },
      update: {
        ...(callTime && { callTime }),
        ...(order && { order }),
        ...(rangeStart !== undefined && { rangeStart: parseInt(rangeStart) }),
        ...(rangeEnd !== undefined && { rangeEnd: parseInt(rangeEnd) }),
      },
      create: {
        listNumber: parseInt(listNumber),
        callTime: callTime || '06:00',
        order: order || 'ascendente',
        rangeStart: rangeStart || 1,
        rangeEnd: rangeEnd || 20,
      },
    });

    res.json(settings);
  } catch (error) {
    console.error('Update list settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateListOrder = async (req, res) => {
  try {
    const { listNumber } = req.params;
    const { order } = req.body;

    if (!order || !['ascendente', 'descendente'].includes(order)) {
      return res.status(400).json({ error: 'Order must be ascendente or descendente' });
    }

    const settings = await prisma.listSettings.update({
      where: { listNumber: parseInt(listNumber) },
      data: { order },
    });

    // Reorder queue based on new order
    await reorderQueue(parseInt(listNumber), order);

    res.json(settings);
  } catch (error) {
    console.error('Update list order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateListRange = async (req, res) => {
  try {
    const { listNumber } = req.params;
    const { rangeStart, rangeEnd } = req.body;

    if (rangeStart === undefined || rangeEnd === undefined) {
      return res.status(400).json({ error: 'rangeStart and rangeEnd are required' });
    }

    if (parseInt(rangeStart) > parseInt(rangeEnd)) {
      return res.status(400).json({ error: 'rangeStart must be less than or equal to rangeEnd' });
    }

    const settings = await prisma.listSettings.update({
      where: { listNumber: parseInt(listNumber) },
      data: {
        rangeStart: parseInt(rangeStart),
        rangeEnd: parseInt(rangeEnd),
      },
    });

    res.json(settings);
  } catch (error) {
    console.error('Update list range error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getQueueForList = async (req, res) => {
  try {
    const { listNumber } = req.params;

    const settings = await prisma.listSettings.findUnique({
      where: { listNumber: parseInt(listNumber) },
    });

    if (!settings) {
      return res.status(404).json({ error: 'List settings not found' });
    }

    let query = {
      where: {
        listNumber: parseInt(listNumber),
        available: true,
      },
      include: {
        caddie: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: { position: 'asc' },
    };

    // Apply range filter
    if (settings.rangeStart && settings.rangeEnd) {
      const queues = await prisma.caddieQueue.findMany(query);
      const filtered = queues.filter((q) => q.position >= settings.rangeStart && q.position <= settings.rangeEnd);
      return res.json(filtered);
    }

    const queues = await prisma.caddieQueue.findMany(query);

    // Apply order filter
    if (settings.order === 'descendente') {
      queues.reverse();
    }

    res.json(queues);
  } catch (error) {
    console.error('Get queue for list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper function to reorder queue
async function reorderQueue(listNumber, order) {
  const queues = await prisma.caddieQueue.findMany({
    where: { listNumber },
    orderBy: { position: 'asc' },
  });

  const sortedQueues = order === 'descendente' ? queues.reverse() : queues;

  for (let i = 0; i < sortedQueues.length; i++) {
    await prisma.caddieQueue.update({
      where: { id: sortedQueues[i].id },
      data: { position: i + 1 },
    });
  }
}
