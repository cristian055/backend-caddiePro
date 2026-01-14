# AGENTS.md - CaddiePro Backend

Multi-sport venue management system. **Tech Stack:** Node.js, Express, Prisma, PostgreSQL, Socket.IO, JWT.

## Commands

```bash
# Development
npm run dev                    # Hot reload (port 3000)
npm start                      # Production mode

# Testing
npm test                       # All tests
npm run test:watch             # Watch mode
npm run test:coverage          # Coverage report
npm run test:single tests/caddies.test.js                    # Single test file
npm run test:single -- --testNamePattern="should get all"   # Filter by pattern

# Database
npm run prisma:generate        # Regenerate Prisma client
npm run prisma:migrate         # Run migrations
npm run prisma:push            # Push schema changes (dev)
npm run prisma:studio          # Prisma Studio GUI
npm run prisma:seed            # Seed database
npm run import:caddies         # Import caddies from CSV
npm run reset:admin:force      # Reset admin password

# Full Setup
npm run install:all            # Install + generate + push + seed
```

## Code Style

### Structure
```
src/
├── config/      # database.js, websocket.js
├── controllers/ # HTTP handlers (lightweight)
├── middleware/  # auth.js
├── services/    # Business logic + Prisma
├── validators/  # Input validation
├── routes/      # Express routes
├── utils/       # jwt.js, password.js, websocketEmitter.js
└── server.js
```

### Import Order
External libs → internal utils → internal config → relative modules (always `.js` extension)
```javascript
import express from 'express';
import prisma from '../config/database.js';
import { emitQueueUpdated } from '../utils/websocketEmitter.js';
import { authenticate } from '../middleware/auth.js';
```

### Naming Conventions
camelCase variables/functions (`getCaddie`, `createCaddie`), PascalCase classes (`UserService`), UPPER_SNAKE_CASE constants, kebab-case routes

### Response Format
```javascript
// Success: res.status(200).json({ success: true, data: {...} });
// Error: res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '...' } });

export const getCaddie = async (req, res) => {
  try {
    const caddie = await prisma.caddie.findUnique({ where: { id: req.params.id } });
    if (!caddie) return res.status(404).json({
      success: false, error: { code: 'NOT_FOUND', message: 'Caddie not found' }
    });
    res.json({ success: true, data: caddie });
  } catch (error) {
    console.error('Get caddie error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' } });
  }
};
```

**Error Codes**: `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `DUPLICATE_ENTRY` (409), `INTERNAL_ERROR` (500)

**Status Codes**: GET 200/404, POST 201/400/409, PUT/PATCH 200/400/404, DELETE 200/404

### Validation
Use `express-validator` for routes, import validators from `validators.js`
```javascript
import { body, param } from 'express-validator';
router.post('/', authenticate, [
  body('name').isLength({ min: 2, max: 100 }),
  body('category').isIn(['PRIMERA', 'SEGUNDA', 'TERCERA']),
  param('id').isUUID()
], createCaddie);
```

## Database (Prisma)

Import from `src/config/database.js`. Use `@map`/`@@map` for snake_case, `findFirst` for composite keys.
```javascript
const existing = await prisma.caddie.findFirst({ where: { number, category } });
await prisma.$transaction([
  prisma.caddie.update({ where: { id }, data: { status } }),
  prisma.dispatchHistory.create({ data: { caddieId, previousStatus, newStatus } })
]);
```

## Service Layer Pattern
- **Controllers**: HTTP only (validate, call service, emit WebSocket, return response)
- **Services**: Business logic + Prisma queries + transactions + transforms
- **Validators**: Centralized valid value sets (statuses, categories)

Flow: `Request → Controller → Validator → Service → Prisma → Response`

## WebSocket (Critical!)
Always emit events after state changes for frontend sync.
```javascript
import { emitListUpdated, emitQueueUpdated } from '../utils/websocketEmitter.js';
export const updateList = async (req, res) => {
  const updatedList = await prisma.listConfig.update({...});
  emitListUpdated(updatedList.id, updatedList);
  emitQueueUpdated(updatedList.category);
  res.json({ success: true, data: updatedList });
};
```

**Events**: `caddie:status_changed`, `caddie:added`, `caddie:updated`, `caddie:deleted`, `caddie:dispatched`, `queue:updated`, `list:updated`, `daily_attendance:updated`

**Payload**: `{ event, data: {...}, timestamp }` (nested for frontend)

**Rooms**: `list-1` (PRIMERA), `list-2` (SEGUNDA), `list-3` (TERCERA)

## Authentication
- JWT: `Authorization: Bearer <token>`
- Routes: `authenticate` (required), `optionalAuth` (optional)
- User attached to `req.user`

## Environment
```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-secret
JWT_EXPIRES_IN=24h
CORS_ORIGINS=http://localhost:5173,https://frontend.vercel.app
NODE_ENV=development
PORT=3000
```

## API Endpoints
**Public**: `GET /api/public/queue`, `GET /api/public/lists`, `GET /api/public/lists/:listNumber`

**Auth Required**: `POST /api/auth/login`, CRUD `/api/caddies`, `PATCH /api/caddies/:id/status`, `POST /api/dispatch/bulk`, `/api/lists`, `/api/attendance/*`, `/api/reports/*`

## Daily Attendance
Tracks caddie attendance: `POST /api/attendance/daily`, `GET /api/attendance/daily/:date/stats`, `GET /api/reports/daily/:date/attendance`, `POST /api/reports/close/:date`

**Auto-created** on caddie status changes (PRESENT/ABSENT/ON_LEAVE/LATE). Increment `servicesCount` on service completion. Emit `daily_attendance:updated`. Archive to `ServiceLog` on close day.

## Git Commits
Format: `type(scope): description` - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
Examples: `feat(caddies): add bulk dispatch`, `fix(auth): token expiration`, `refactor(lists): extract validation`

## Common Issues
- **CORS**: Add origin to `CORS_ORIGINS` (comma-separated)
- **JWT**: `JWT_EXPIRES_IN=24h` (no quotes, no "s")
- **Prisma**: Run `npm run prisma:generate` after schema changes
- **Tests**: Use `--testNamePattern` for filtering
- **ESM**: Always use `.js` extensions, never `.ts`
- **WebSocket**: Always emit after state changes
- **Ports**: Backend 3000, frontend 5173
