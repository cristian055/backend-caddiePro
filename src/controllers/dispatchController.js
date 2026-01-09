import prisma from '../config/database.js';
import { emitCaddieStatusChanged, emitCaddieDispatched, emitQueueUpdated } from '../utils/websocketEmitter.js';

/**
 * POST /dispatch/bulk
 * Bulk dispatch caddies and trigger WebSocket notification
 */
export const bulkDispatch = async (req, res) => {
  try {
    const { updates } = req.body;

    console.log('[Dispatch] Bulk dispatch request received:', JSON.stringify(updates, null, 2));

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Updates array is required' },
      });
    }

    const dispatched = [];
    const dispatchedCaddies = [];
    const errors = [];

    for (const update of updates) {
      const { id, status, listId } = update;

      try {
        // Validate id
        if (!id) {
          errors.push({ id, error: 'Missing caddie ID' });
          continue;
        }

        // Validate status
        const validStatuses = ['AVAILABLE', 'IN_PREP', 'IN_FIELD', 'LATE', 'ABSENT', 'ON_LEAVE'];
        if (!status || !validStatuses.includes(status)) {
          errors.push({ id, error: `Invalid status: ${status}` });
          continue;
        }

        const caddie = await prisma.caddie.findUnique({ where: { id } });
        if (!caddie) {
          errors.push({ id, error: 'Caddie not found' });
          continue;
        }

        const previousStatus = caddie.status;

        // Update caddie status
        const updatedCaddie = await prisma.caddie.update({
          where: { id },
          data: {
            status,
            lastActionTime: new Date(),
          },
        });

        // Resolve listId - supports both UUID and 'list-N' format
        let validListId = null;
        if (listId) {
          // First try direct UUID lookup
          let listConfig = await prisma.listConfig.findUnique({ where: { id: listId } });
          
          // If not found, check if it's 'list-N' format and lookup by category
          if (!listConfig && typeof listId === 'string' && listId.startsWith('list-')) {
            const listNumber = listId.replace('list-', '');
            const categoryMap = { '1': 'Primera', '2': 'Segunda', '3': 'Tercera' };
            const category = categoryMap[listNumber];
            if (category) {
              listConfig = await prisma.listConfig.findFirst({ where: { category } });
            }
          }
          
          if (listConfig) {
            validListId = listConfig.id;
          } else {
            console.warn(`[Dispatch] ListConfig not found for listId: ${listId}, will be set to null`);
          }
        }

        // Log to dispatch history
        await prisma.dispatchHistory.create({
          data: {
            caddieId: id,
            previousStatus,
            newStatus: status,
            listId: validListId,
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
        emitCaddieStatusChanged(updatedCaddie, previousStatus);
        
        console.log(`[Dispatch] Caddie ${updatedCaddie.name} (${updatedCaddie.number}) status changed: ${previousStatus} -> ${status}`);
      } catch (updateError) {
        console.error(`[Dispatch] Error updating caddie ${id}:`, updateError);
        errors.push({ id, error: updateError.message });
      }
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

    console.log(`[Dispatch] Bulk dispatch completed: ${dispatched.length} updated, ${errors.length} errors`);

    res.json({
      success: true,
      data: {
        dispatched,
        timestamp,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('Bulk dispatch error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' },
    });
  }
};
