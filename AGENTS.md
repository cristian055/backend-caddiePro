# AGENTS.md - CaddiePro Backend Guidelines

Multi-sport venue management system. **Tech Stack:** Node.js, Express, Prisma, PostgreSQL, Socket.IO, JWT.

## Commands

```bash
# Development
npm run dev                        # Hot reload (port 3000)
npm start                          # Production mode

# Testing
npm test                            # All tests
npm run test:watch                  # Watch mode
npm run test:coverage               # Coverage report
npm run test:single tests/file.test.js          # Run single test file
npm run test:single -- --testNamePattern="name"  # Run by test name pattern

# Database (Prisma)
npm run prisma:generate             # Regenerate Prisma client
npm run prisma:migrate              # Run database migrations
npm run prisma:push                 # Push schema changes (dev)
npm run prisma:studio               # Open Prisma Studio GUI
npm run prisma:seed                 # Seed database
npm run import:caddies              # Import caddies from CSV
npm run reset:admin:force           # Reset admin password to 'admin123'

# Full Setup
npm run install:all                 # Install + generate + push + seed
```

## Code Style

### File Structure
```
src/
├── config/         # database.js, websocket.js
├── controllers/    # Business logic (e.g., caddieController.js)
├── middleware/     # auth.js
├── routes/         # Express routes (e.g., caddie.js)
├── utils/          # jwt.js, password.js, websocketEmitter.js
└── server.js       # Entry point
tests/              # *.test.js files
prisma/             # schema.prisma, seed.js
```

### Imports & Files
- ES Modules (`import`/`export`), type: "module" in package.json
- Always include `.js` file extensions in imports
- Import order: External libs → internal utils → internal config → relative modules

```javascript
import express from 'express';
import prisma from '../config/database.js';
import { emitQueueUpdated } from '../utils/websocketEmitter.js';
import { authenticate } from '../middleware/auth.js';
```

### Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Variables/functions | camelCase | `getCaddie`, `createCaddie` |
| Classes | PascalCase | `UserService` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_ATTEMPTS` |
| Database models | PascalCase | `Caddie`, `User` |
| Routes | kebab-case | `/api/caddies/:id/status` |

### Response & Error Handling
```javascript
// Success: res.status(200).json({ success: true, data: {...} });
// Error: res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '...' } });

// Controller pattern with try/catch
export const getCaddie = async (req, res) => {
  try {
    const caddie = await prisma.caddie.findUnique({ where: { id: req.params.id } });
    if (!caddie) return res.status(404).json({
      success: false, error: { code: 'NOT_FOUND', message: 'Caddie not found' }
    });

    res.json({ success: true, data: caddie });
  } catch (error) {
    console.error('Get caddie error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
};
```

**Error Codes**: `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `DUPLICATE_ENTRY` (409), `INTERNAL_ERROR` (500)

**Status Codes**: GET 200/404 | POST 201/400/409 | PUT/PATCH 200/400/404 | DELETE 200/404

### Validation (express-validator)
```javascript
import { body, param } from 'express-validator';

router.post('/', authenticate, [
  body('name').isLength({ min: 2, max: 100 }),
  body('category').isIn(['Primera', 'Segunda', 'Tercera']),
  body('number').isInt({ min: 1, max: 999 }),
  body('rangeStart').isInt({ min: 1, max: 999 }),
  body('rangeEnd').isInt({ min: 1, max: 999 }),
  param('id').isUUID()
], createCaddie);
```

## Database (Prisma + PostgreSQL)

- Import prisma from `src/config/database.js`
- Use `@map` for snake_case columns, `@@map` for snake_case tables
- Composite unique: use `findFirst`, not `findUnique`
- Use transactions for multi-step operations

```javascript
const existing = await prisma.caddie.findFirst({ where: { number, category } });
await prisma.$transaction([
  prisma.caddie.update({ where: { id }, data: { status } }),
  prisma.dispatchHistory.create({ data: { caddieId, previousStatus, newStatus } })
]);
```

## WebSocket Integration

**Critical**: Always emit WebSocket events after state changes to keep frontend in sync.

```javascript
// Emit list updates
import { emitListUpdated, emitQueueUpdated } from '../utils/websocketEmitter.js';

export const updateList = async (req, res) => {
  const updatedList = await prisma.listConfig.update({...});

  // Emit events for real-time sync
  emitListUpdated(updatedList.id, { /* list config */ });
  emitQueueUpdated(updatedList.category);

  res.json({ success: true, data: updatedList });
};
```

**Emitted Events**: `caddie:status_changed`, `caddie:added`, `caddie:updated`, `caddie:deleted`, `caddie:dispatched`, `queue:updated`, `list:updated`, `daily_attendance:updated`

**Payload**: `{ event, data: {...}, timestamp }` - nested data for frontend compatibility

**Rooms**: `list-1` (Primera), `list-2` (Segunda), `list-3` (Tercera)

**Client Events**: `subscribe` (join rooms), `unsubscribe` (leave rooms), `ping/pong` (health check)

## Authentication

- JWT header: `Authorization: Bearer <token>`
- Admin routes: `authenticate` middleware, public routes: `optionalAuth`
- User attached to `req.user` after successful authentication

## Environment Variables
```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h
CORS_ORIGINS=http://localhost:5173,https://frontend.vercel.app
NODE_ENV=development
PORT=3000
```

## API Endpoints

**Public (No Auth)**: `GET /api/public/queue`, `GET /api/public/lists`, `GET /api/public/lists/:listNumber`

**Admin (Auth Required)**: `POST /api/auth/login`, `GET/POST/PUT/DELETE /api/caddies`, `PATCH /api/caddies/:id/status`, `POST /api/dispatch/bulk`, `GET/POST /api/lists`, `GET/POST /api/attendance/*`, `GET/POST /api/reports/*`

### Daily Attendance Tracking

**Purpose**: Track caddie daily attendance (present, absent, on leave, late) and display statistics in Reports view.

**Database Model**: `DailyAttendance` - Tracks caddie attendance per day
```javascript
model DailyAttendance {
  id            String    @id
  caddieId      String
  date          DateTime  @db.Date
  status        String    // 'PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE'
  arrivalTime   DateTime?
  servicesCount Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([caddieId, date])
}
```

**Endpoints**:
- `POST /api/attendance/daily` - Create/update daily attendance record (caddieId, date, status)
- `GET /api/attendance/daily/:date` - Get all attendance records for a date
- `GET /api/attendance/daily/:date/stats` - Get summary statistics (present, late, absent, onLeave, worked)
- `PUT /api/attendance/daily/:id` - Update existing attendance record
- `GET /api/reports/daily/:date/attendance` - Get detailed daily attendance report with stats
- `POST /api/reports/close/:date` - Archive daily attendance to ServiceLog and close day

**Implementation Details**:
1. **Automatic Creation**: Attendance records are auto-created when caddie status changes in:
   - `caddieController.js` - `updateCaddie` and `updateCaddieStatus` functions
   - Validates status and creates `DailyAttendance` with appropriate `arrivalTime`

2. **Status Flow**:
   - Caddie clicks "Salir a Cargar" → Status `AVAILABLE` → `IN_PREP` → Create DailyAttendance(`PRESENT`)
   - Caddie clicks "No vino" → Status `AVAILABLE` → `ABSENT` → Create DailyAttendance(`ABSENT`)
   - Caddie clicks "Permiso" → Status `AVAILABLE` → `ON_LEAVE` → Create DailyAttendance(`ON_LEAVE`)
   - Caddie clicks "Tarde" → Status `AVAILABLE` → `LATE` → Create DailyAttendance(`LATE`)
   - Caddie completes service (IN_PREP → IN_FIELD) → Increment `servicesCount` in DailyAttendance

3. **WebSocket Events**:
   - `daily_attendance:updated` - Emitted after creating/updating attendance
   - Frontend listens in `Reports.tsx` for real-time updates

4. **Close Day Process**:
   - Archives DailyAttendance records to ServiceLog
   - Resets daily counters
   - Creates historical record for reporting

**Response Format**:
```javascript
{
  success: true,
  data: {
    id: "uuid",
    caddieId: "caddie-uuid",
    caddie: { id, name, number, category, location },
    date: "2024-01-11T00:00:00.000Z",
    status: "PRESENT",
    arrivalTime: "2024-01-11T08:30:00.000Z",
    servicesCount: 2
  }
}
```

**Stats Summary**:
```javascript
{
  date: "2024-01-11",
  total: 10,
  present: 5,
  late: 1,
  absent: 2,
  onLeave: 2,
  worked: 6  // servicesCount > 0
}
```

**Important Notes**:
- Use explicit `findUnique` → `update`/`create` instead of `upsert` for composite keys (avoids SQL issues)
- Always emit WebSocket events after database changes
- Set `arrivalTime` for PRESENT and LATE statuses
- Archive to ServiceLog when closing day to maintain historical records

## Git Commits

Format: `type(scope): description` - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

Examples:
- `feat(caddies): add bulk dispatch endpoint`
- `fix(auth): resolve token expiration issue`
- `refactor(lists): extract validation logic to utils`
- `test(dispatch): add coverage for bulk dispatch`
- `chore(deps): upgrade socket.io to v4.8.3`

## Common Issues

1. **CORS** - Add origin to `CORS_ORIGINS` env var (comma-separated)
2. **JWT** - Ensure `JWT_EXPIRES_IN=24h` (no quotes, no "s" for hours)
3. **PostgreSQL** - `DATABASE_URL` must be valid connection string with correct port
4. **Prisma** - Run `npm run prisma:generate` after schema changes
5. **Tests** - Use `--testNamePattern` to filter by test name pattern
6. **ESM** - Always use `.js` extensions in imports, never `.ts` (transpiled)
7. **WebSocket sync** - Always emit events after state changes (list, queue, dispatch)
8. **Port conflicts** - Backend runs on port 3000, frontend on 5173
