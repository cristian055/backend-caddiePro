# Queue Architecture Refactoring - Quick Start

## What Was Changed

### Schema Improvements (schema.prisma)

1. **Prisma Enums Added** - Type-safe enumerations
   - UserRole, CaddieRole, CaddieCategory
   - CaddieOperationalStatus, AttendanceStatus
   - OrderType, DayOfWeek, AvailabilityRangeType

2. **Queue Positions Table** - New table for operational queue state
   - Separates queue position/status from permanent caddie data
   - UNIQUE(category, position) constraint prevents gaps
   - Enables category promotions without data corruption

3. **Status Separation**
   - Operational status (AVAILABLE, IN_PREP, IN_FIELD) → `queue_positions`
   - Administrative status (PRESENT, LATE, ABSENT, ON_LEAVE) → `daily_attendance`

4. **Category Required** - No more NULL categories, default is 'TERCERA'

5. **Composite Indexes** - Performance optimization
   - caddies(location, category, isActive)
   - dispatch_history(location, dispatchedAt)
   - daily_attendance(date)
   - queue_positions(category, operationalStatus)

6. **Redundant Fields Removed**
   - Caddie: historyCount, absencesCount, lateCount, leaveCount
   - WeeklyAssignment: caddieName, caddieNumber, category

7. **Cleanup**
   - Removed duplicate content (lines 225-449)
   - Prisma client regenerated

---

## How to Apply Changes (When Database is Online)

Since you only have 5 test caddies, we'll reset and recreate everything:

### Step 1: Reset Database (Drop Test Data)

```bash
cd backend-caddiePro
node scripts/reset-db.js
```

### Step 2: Push New Schema to Database

```bash
cd backend-caddiePro
npx prisma db push
```

### Step 3: Seed with Test Data

```bash
cd backend-caddiePro
node prisma/seed-dev.js
```

### Step 4: Verify Data

```bash
cd backend-caddiePro
node -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const caddies = await prisma.caddie.findMany({
  include: { queuePosition: true }
});
console.log('Caddies:', caddies.length);
console.log(JSON.stringify(caddies, null, 2));
await prisma.\$disconnect();
"
```

---

## Example Queries with New Schema

### Get All Available Caddies in Category

```javascript
const availableCaddies = await prisma.queuePosition.findMany({
  where: {
    category: 'PRIMERA',
    operationalStatus: 'AVAILABLE',
  },
  include: {
    caddie: {
      select: {
        name: true,
        number: true,
        location: true,
      },
    },
  },
  orderBy: { position: 'asc' },
});
```

### Get Caddie's Current Status (Combined)

```javascript
const caddieWithStatus = await prisma.caddie.findUnique({
  where: { id: caddieId },
  include: {
    queuePosition: true,  // Operational: AVAILABLE, IN_PREP, IN_FIELD
    dailyAttendances: {    // Administrative: PRESENT, LATE, ABSENT, ON_LEAVE
      where: { date: today }
    }
  },
});

// Combined status: "LATE + IN_FIELD"
const operationalStatus = caddieWithStatus.queuePosition?.operationalStatus;
const attendanceStatus = caddieWithStatus.dailyAttendances[0]?.status;
```

### Promote Caddie to New Category

```javascript
// Atomic category promotion
await prisma.$transaction(async (tx) => {
  // 1. Update caddie's category
  await tx.caddie.update({
    where: { id: caddieId },
    data: { category: 'SEGUNDA' },
  });

  // 2. Remove from old queue
  await tx.queuePosition.delete({
    where: { caddieId: caddieId },
  });

  // 3. Add to new queue with new position
  await tx.queuePosition.create({
    data: {
      caddieId: caddieId,
      category: 'SEGUNDA',
      position: await getNextPosition(tx, 'SEGUNDA'),
      operationalStatus: 'AVAILABLE',
    },
  });

  // 4. Recalculate old category positions (shift remaining caddies)
  await recalculateQueuePositions(tx, 'PRIMERA');
});
```

---

## Files Created/Modified

### Modified
- `prisma/schema.prisma` - Refactored schema with enums and queue_positions table

### Created
- `scripts/reset-db.js` - Drop all test data
- `prisma/seed-dev.js` - Seed with 5 test caddies and queue positions
- `prisma/migrations/002_refactor_queue_architecture.sql` - SQL migration script (reference)
- `prisma/migrations/002_refactor_queue_architecture.js` - JS migration script (reference)

---

## Next Steps (Backend)

1. Update services to read/write `queue_positions` table
2. Implement category promotion logic with transaction safety
3. Update WebSocket events to include queue position changes
4. Update API responses to include both operational and administrative status

---

## Next Steps (Frontend)

1. Update stores (CaddieStore, ListStore) to consume new queue structure
2. Update components to display combined status (operational + administrative)
3. Implement category promotion UI with position reordering
4. Handle new enum values in TypeScript types

---

## Troubleshooting

### Error: "Value 'Primera' not found in enum 'CaddieCategory'"
**Solution**: Run `npx prisma db push` to update database schema with new enum values

### Error: "Can't reach database server"
**Solution**: Check DATABASE_URL in `.env` file, ensure database is running

### Error: "Unique constraint failed on queue_positions"
**Solution**: Run `node scripts/reset-db.js` to drop old data before pushing new schema

---

## Architecture Benefits

✅ **Separation of Concerns**: Permanent data vs volatile operational state  
✅ **Category Promotions**: Can now promote caddies without data corruption  
✅ **No Position Gaps**: UNIQUE constraint prevents gaps (no 1,2,3,5)  
✅ **Dual States**: Can represent "LATE + IN_FIELD" simultaneously  
✅ **Type Safety**: Enums prevent invalid values in database  
✅ **Performance**: Composite indexes optimize common queries  
✅ **No Redundancy**: Removed duplicate counter fields that could drift

---

## Support

If you encounter any issues, check:
1. Database connection: `npx prisma studio`
2. Schema validation: `npx prisma validate`
3. Generated client: `npx prisma generate`
