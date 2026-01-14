import prisma from '../config/database.js';

/**
 * QueuePositionService - Handles all queue position business logic
 */
export class QueuePositionService {
  /**
   * Get available caddies in a category, ordered by position
   */
  async getAvailableCaddies(category, location = 'Llanogrande') {
    const queuePositions = await prisma.queuePosition.findMany({
      where: {
        category,
        operationalStatus: 'AVAILABLE',
        caddie: {
          isActive: true,
          location,
        },
      },
      include: {
        caddie: {
          select: {
            id: true,
            name: true,
            number: true,
            role: true,
          },
        },
      },
      orderBy: {
        position: 'asc',
      },
    });

    return queuePositions.map(qp => ({
      id: qp.id,
      position: qp.position,
      operationalStatus: qp.operationalStatus,
      caddie: qp.caddie,
    }));
  }

  /**
   * Get caddie's current queue position
   */
  async getCaddiePosition(caddieId) {
    const queuePosition = await prisma.queuePosition.findUnique({
      where: {
        caddieId,
      },
      include: {
        caddie: {
          select: {
            id: true,
            name: true,
            number: true,
            category: true,
          },
        },
      },
    });

    if (!queuePosition) {
      return null;
    }

    return {
      id: queuePosition.id,
      position: queuePosition.position,
      operationalStatus: queuePosition.operationalStatus,
      category: queuePosition.category,
      lastDispatchedAt: queuePosition.lastDispatchedAt,
      caddie: queuePosition.caddie,
    };
  }

  /**
   * Get complete queue for a category
   */
  async getQueueByCategory(category) {
    const queuePositions = await prisma.queuePosition.findMany({
      where: {
        category,
      },
      include: {
        caddie: true,
      },
      orderBy: {
        position: 'asc',
      },
    });

    return queuePositions.map(qp => ({
      id: qp.id,
      position: qp.position,
      operationalStatus: qp.operationalStatus,
      category: qp.category,
      lastDispatchedAt: qp.lastDispatchedAt,
      caddie: qp.caddie,
    }));
  }

  /**
   * Update caddie's operational status
   */
  async updateOperationalStatus(caddieId, status) {
    const validStatuses = ['AVAILABLE', 'IN_PREP', 'IN_FIELD'];
    if (!status || !validStatuses.includes(status)) {
      throw new Error(`Status must be one of: ${validStatuses.join(', ')}`);
    }

    const queuePosition = await prisma.queuePosition.findUnique({
      where: {
        caddieId,
      },
    });

    if (!queuePosition) {
      throw new Error('Queue position not found for this caddie');
    }

    const updateData = {
      operationalStatus: status,
    };

    if (status !== 'AVAILABLE') {
      updateData.lastDispatchedAt = new Date();
    } else {
      updateData.lastDispatchedAt = null;
    }

    const updated = await prisma.queuePosition.update({
      where: {
        caddieId,
      },
      data: updateData,
      include: {
        caddie: true,
      },
    });

    return {
      id: updated.id,
      position: updated.position,
      operationalStatus: updated.operationalStatus,
      category: updated.category,
      lastDispatchedAt: updated.lastDispatchedAt,
      caddie: updated.caddie,
      previousStatus: queuePosition.operationalStatus,
    };
  }
}

export const queuePositionService = new QueuePositionService();
