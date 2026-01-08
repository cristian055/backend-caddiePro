import prisma from '../config/database.js';

const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * GET /public/queue
 * Get current queue state for public monitor
 */
export const getPublicQueue = async (req, res) => {
  try {
    // Get list configurations
    const listConfigs = await prisma.listConfig.findMany();
    
    // Build queue for each category
    const queue = {
      Primera: [],
      Segunda: [],
      Tercera: [],
    };

    for (const config of listConfigs) {
      const caddies = await prisma.caddie.findMany({
        where: {
          isActive: true,
          category: config.category,
          status: { in: ['AVAILABLE', 'LATE'] },
          number: {
            gte: config.rangeStart,
            lte: config.rangeEnd,
          },
        },
        orderBy: getOrderBy(config.orderType),
        take: 5, // Return top 5 per category
      });

      queue[config.category] = caddies.map(c => ({
        id: c.id,
        name: c.name,
        number: c.number,
        status: c.status,
        category: c.category,
        weekendPriority: c.weekendPriority,
      }));
    }

    // If no configs exist, get caddies by default order
    for (const category of ['Primera', 'Segunda', 'Tercera']) {
      if (queue[category].length === 0) {
        const caddies = await prisma.caddie.findMany({
          where: {
            isActive: true,
            category,
            status: { in: ['AVAILABLE', 'LATE'] },
          },
          orderBy: [{ number: 'asc' }],
          take: 5,
        });

        queue[category] = caddies.map(c => ({
          id: c.id,
          name: c.name,
          number: c.number,
          status: c.status,
          category: c.category,
          weekendPriority: c.weekendPriority,
        }));
      }
    }

    res.json({
      success: true,
      data: {
        ...queue,
        lastUpdate: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Get public queue error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

/**
 * GET /public/weekly
 * Get weekly schedule (read-only)
 */
export const getPublicWeekly = async (req, res) => {
  try {
    const { day, location } = req.query;

    const shiftWhere = {};
    if (day && VALID_DAYS.includes(day)) shiftWhere.day = day;
    if (location) shiftWhere.location = location;

    const shifts = await prisma.weeklyShift.findMany({
      where: shiftWhere,
      include: {
        requirements: true,
        assignments: true,
      },
      orderBy: [{ day: 'asc' }, { time: 'asc' }],
    });

    res.json({
      success: true,
      data: {
        day: day || 'all',
        shifts: shifts.map(s => ({
          id: s.id,
          day: s.day,
          time: s.time,
          location: s.location,
          requirements: s.requirements.map(r => ({
            category: r.category,
            count: r.count,
          })),
        })),
        assignments: shifts.flatMap(s => 
          s.assignments.map(a => ({
            shiftId: a.shiftId,
            caddieId: a.caddieId,
            caddieName: a.caddieName,
            caddieNumber: a.caddieNumber,
            category: a.category,
            time: s.time,
            day: s.day,
          }))
        ),
      },
    });
  } catch (error) {
    console.error('Get public weekly error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
};

// Helper function to get order by based on order type
function getOrderBy(orderType) {
  switch (orderType) {
    case 'DESC':
      return [{ number: 'desc' }];
    case 'RANDOM':
    case 'MANUAL':
      return [{ weekendPriority: 'asc' }];
    case 'ASC':
    default:
      return [{ number: 'asc' }];
  }
}
