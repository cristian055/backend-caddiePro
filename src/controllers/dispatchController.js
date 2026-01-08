import prisma from '../config/database.js';
import { emitCaddieStatusChanged, emitCaddieDispatched, emitQueueUpdated } from '../utils/websocketEmitter.js';

/**
 * POST /dispatch/bulk
 * Bulk dispatch caddies and trigger WebSocket notification
 */
export const bulkDispatch = async (req, res) => {
  try {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Updates array is required' },
      });
    }

    const dispatched = [];
    const dispatchedCaddies = [];

    for (const update of updates) {
      const { id, status, listId } = update;

      const caddie = await prisma.caddie.findUnique({ where: { id } });
      if (!caddie) continue;

      const previousStatus = caddie.status;

      // Update caddie status
      const updatedCaddie = await prisma.caddie.update({
        where: { id },
        data: {
          status,
          lastActionTime: new Date(),
        },
      });

      // Log to dispatch history
      await prisma.dispatchHistory.create({
        data: {
          caddieId: id,
          previousStatus,
          newStatus: status,
          listId: listId || null,
          location: caddie.location,
        },
      });

      dispatched.push(id);
      dispatchedCaddies.push({
        id: updatedCaddie.id,
        name: updatedCaddie.name,
        number: updatedCaddie.number,
        category: updatedCaddie.category,
      });

      // Emit status change for each caddie
      emitCaddieStatusChanged(updatedCaddie);
    }

    const timestamp = Date.now();

    // Emit batch dispatch event
    if (dispatchedCaddies.length > 0) {
      emitCaddieDispatched(dispatched, dispatchedCaddies, timestamp);
      
      // Emit queue updated for affected categories
      const categories = [...new Set(dispatchedCaddies.map(c => c.category))];
      for (const category of categories) {
        emitQueueUpdated(category);
      }
    }

    res.json({
      success: true,
      data: {
        dispatched,
        timestamp,
      },
    });
  } catch (error) {
    console.error('Bulk dispatch error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};
