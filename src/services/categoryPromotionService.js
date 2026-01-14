import prisma from '../config/database.js';
import { VALID_CATEGORIES } from '../validators/validators.js';

const VALID_TRANSITIONS = [
  { from: 'TERCERA', to: 'SEGUNDA' },
  { from: 'SEGUNDA', to: 'PRIMERA' },
];

export class CategoryPromotionService {
  async promoteCaddie(caddieId, fromCategory, toCategory) {
    if (!caddieId) {
      throw new Error('Caddie ID is required');
    }

    if (!VALID_CATEGORIES.includes(fromCategory)) {
      throw new Error(`Invalid fromCategory: ${fromCategory}`);
    }

    if (!VALID_CATEGORIES.includes(toCategory)) {
      throw new Error(`Invalid toCategory: ${toCategory}`);
    }

    const isValidTransition = VALID_TRANSITIONS.some(
      (t) => t.from === fromCategory && t.to === toCategory
    );

    if (!isValidTransition) {
      return {
        success: false,
        error: 'INVALID_TRANSITION',
        message: `Cannot promote from ${fromCategory} to ${toCategory}`,
        allowedTransitions: VALID_TRANSITIONS.map((t) => `${t.from}->${t.to}`),
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      const currentPosition = await tx.queuePosition.findUnique({
        where: { caddieId },
        include: { caddie: true },
      });

      if (!currentPosition) {
        throw new Error('CADDIE_NOT_IN_QUEUE');
      }

      if (currentPosition.operationalStatus !== 'AVAILABLE') {
        throw new Error('CADDIE_NOT_AVAILABLE');
      }

      const oldPosition = currentPosition.position;

      await tx.caddie.update({
        where: { id: caddieId },
        data: { category: toCategory },
      });

      await tx.queuePosition.delete({
        where: { caddieId },
      });

      await this.#recalculatePositions(tx, fromCategory);

      const newPosition = await this.#getNextPosition(tx, toCategory);

      await tx.queuePosition.create({
        data: {
          caddieId,
          category: toCategory,
          position: newPosition,
          operationalStatus: 'AVAILABLE',
        },
      });

      const caddie = await tx.caddie.findUnique({
        where: { id: caddieId },
        include: { queuePosition: true },
      });

      return { caddie, oldPosition, newPosition };
    });

    return {
      success: true,
      caddie: result.caddie,
      oldPosition: result.oldPosition,
      newPosition: result.newPosition,
      queueRecalculated: true,
    };
  }

  async #recalculatePositions(tx, category) {
    const positions = await tx.queuePosition.findMany({
      where: { category },
      orderBy: { position: 'asc' },
    });

    for (let i = 0; i < positions.length; i++) {
      const newPosition = i + 1;
      if (positions[i].position !== newPosition) {
        await tx.queuePosition.update({
          where: { id: positions[i].id },
          data: { position: newPosition },
        });
      }
    }
  }

  async #getNextPosition(tx, category) {
    const lastPosition = await tx.queuePosition.findFirst({
      where: { category },
      orderBy: { position: 'desc' },
    });

    return lastPosition ? lastPosition.position + 1 : 1;
  }
}

export const categoryPromotionService = new CategoryPromotionService();
