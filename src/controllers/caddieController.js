import prisma from '../config/database.js';
import { emitCaddieAdded, emitCaddieUpdated, emitCaddieDeleted, emitCaddieStatusChanged } from '../utils/websocketEmitter.js';

export const getAllCaddies = async (req, res) => {
  try {
    const caddies = await prisma.caddie.findMany({
      orderBy: [{ listNumber: 'asc' }, { name: 'asc' }],
    });

    res.json(caddies);
  } catch (error) {
    console.error('Get caddies error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCaddieById = async (req, res) => {
  try {
    const { id } = req.params;

    const caddie = await prisma.caddie.findUnique({
      where: { id },
      include: {
        turns: true,
        attendance: true,
      },
    });

    if (!caddie) {
      return res.status(404).json({ error: 'Caddie not found' });
    }

    res.json(caddie);
  } catch (error) {
    console.error('Get caddie error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCaddiesByList = async (req, res) => {
  try {
    const { listNumber } = req.params;

    const caddies = await prisma.caddie.findMany({
      where: { listNumber: parseInt(listNumber) },
      orderBy: [{ listNumber: 'asc' }, { name: 'asc' }],
    });

    res.json(caddies);
  } catch (error) {
    console.error('Get caddies by list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createCaddie = async (req, res) => {
  try {
    const { name, listNumber, phoneNumber, status } = req.body;

    if (!name || !listNumber) {
      return res.status(400).json({ error: 'Name and listNumber are required' });
    }

    if (![1, 2, 3].includes(parseInt(listNumber))) {
      return res.status(400).json({ error: 'ListNumber must be 1, 2, or 3' });
    }

    const caddie = await prisma.caddie.create({
      data: {
        name,
        listNumber: parseInt(listNumber),
        phoneNumber,
        status: status || 'Disponible',
      },
    });

    // Create queue entry for the caddie
    await prisma.caddieQueue.create({
      data: {
        caddieId: caddie.id,
        listNumber: caddie.listNumber,
        position: await getNextPosition(caddie.listNumber),
      },
    });

    // Emit WebSocket event for real-time update
    emitCaddieAdded(caddie);

    res.status(201).json(caddie);
  } catch (error) {
    console.error('Create caddie error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateCaddie = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, listNumber, phoneNumber, status } = req.body;

    if (listNumber && ![1, 2, 3].includes(parseInt(listNumber))) {
      return res.status(400).json({ error: 'ListNumber must be 1, 2, or 3' });
    }

    // Get current caddie to determine old list number
    const oldCaddie = await prisma.caddie.findUnique({ where: { id } });
    if (!oldCaddie) {
      return res.status(404).json({ error: 'Caddie not found' });
    }

    const updates = {};
    if (name) updates.name = name;
    if (listNumber) updates.listNumber = parseInt(listNumber);
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
    if (status) updates.status = status;

    const caddie = await prisma.caddie.update({
      where: { id },
      data: updates,
    });

    // Update queue if list changed
    if (listNumber && parseInt(listNumber) !== oldCaddie.listNumber) {
      await prisma.caddieQueue.update({
        where: { caddieId: id },
        data: {
          listNumber: parseInt(listNumber),
          position: await getNextPosition(parseInt(listNumber)),
        },
      });

      // Emit to both old and new list rooms
      emitCaddieUpdated(id, updates, oldCaddie.listNumber);
      emitCaddieUpdated(id, updates, parseInt(listNumber));
    } else {
      // Emit to current list room only
      emitCaddieUpdated(id, updates, oldCaddie.listNumber);
    }

    res.json(caddie);
  } catch (error) {
    console.error('Update caddie error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteCaddie = async (req, res) => {
  try {
    const { id } = req.params;

    // Get caddie to know list number before deletion
    const caddie = await prisma.caddie.findUnique({ where: { id } });
    if (!caddie) {
      return res.status(404).json({ error: 'Caddie not found' });
    }

    await prisma.caddie.delete({
      where: { id },
    });

    // Emit WebSocket event for real-time update
    emitCaddieDeleted(id, caddie.listNumber);

    res.status(204).send();
  } catch (error) {
    console.error('Delete caddie error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateCaddieStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['Disponible', 'En campo', 'Ausente'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const caddie = await prisma.caddie.update({
      where: { id },
      data: { status },
    });

    // Emit WebSocket event for real-time status update
    emitCaddieStatusChanged(caddie);

    res.json(caddie);
  } catch (error) {
    console.error('Update caddie status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper function to get next position in queue
async function getNextPosition(listNumber) {
  const lastQueue = await prisma.caddieQueue.findFirst({
    where: { listNumber },
    orderBy: { position: 'desc' },
  });
  return lastQueue ? lastQueue.position + 1 : 1;
}
