import prisma from '../config/database.js';
import { VALID_STATUSES } from '../validators/validators.js';

/**
 * DispatchService - Handles bulk dispatch operations
 */
export class DispatchService {
  /**
   * Bulk dispatch caddies
   */
  async bulkDispatch(updates) {
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      throw new Error('Updates array is required');
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
        if (!status || !VALID_STATUSES.includes(status)) {
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
          let listConfig = await prisma.listConfig.findUnique({ where: { id: listId } });

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
      } catch (updateError) {
        errors.push({ id, error: updateError.message });
      }
    }

    return {
      dispatched,
      dispatchedCaddies,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

export const dispatchService = new DispatchService();
