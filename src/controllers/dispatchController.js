import { dispatchService } from '../services/dispatchService.js';
import { emitCaddieStatusChanged, emitCaddieDispatched, emitQueueUpdated } from '../utils/websocketEmitter.js';

export const bulkDispatch = async (req, res) => {
  try {
    const { updates } = req.body;

    console.log('[Dispatch] Bulk dispatch request received:', JSON.stringify(updates, null, 2));

    const { dispatched, dispatchedCaddies, errors } = await dispatchService.bulkDispatch(updates);

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

    console.log(`[Dispatch] Bulk dispatch completed: ${dispatched.length} updated, ${errors?.length || 0} errors`);

    res.json({
      success: true,
      data: {
        dispatched,
        timestamp,
        errors,
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
