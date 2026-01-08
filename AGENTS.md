# AGENTS.md - CaddiePro Backend Guidelines

## Commands

```bash
# Tests
npm test                           # All tests
npm run test:watch                 # Watch mode
npm run test:coverage              # Coverage report
npm run test:single tests/file.test.js    # Single file
npm run test:single -- --testNamePattern="pattern"  # By name

# Database
npm run prisma:generate            # Regenerate client
npm run prisma:push                # Push schema (dev)
npm run prisma:seed                # Seed data
npm run reset:admin:force          # Reset admin password
npm run import:caddies             # Import from CSV

# Server
npm run dev                        # Hot reload (port 3000)
npm start                          # Production
npm run install:all                # Full setup
```

## Code Style

### Imports & Files
- ES modules (`import`/`export`)
- Order: external libs → internal utils → internal config → relative modules
- Files: `*Controller.js`, `*.js` (routes, middleware, utils)
- No TypeScript - plain JavaScript (.js)

```javascript
import express from 'express';
import prisma from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
```

### Naming
- Variables/functions: `camelCase`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Database models: `PascalCase` (Prisma)
- Routes: kebab-case URL paths

### Response Format
Always use consistent response structure:

```javascript
// Success
res.status(200).json({ success: true, data: {...}, message: 'Optional' });
// Error
res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '...' } });
```

### Error Codes
- `VALIDATION_ERROR` - Invalid input (400)
- `NOT_FOUND` - Resource doesn't exist (404)
- `DUPLICATE_ENTRY` - Unique constraint violation (409)
- `INTERNAL_ERROR` - Server error (500)

### Error Handling Pattern
```javascript
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

### HTTP Status Codes
GET: 200/404 | POST: 201/400/409 | PUT: 200/400/404 | DELETE: 200/404 | PATCH: 200/400/404

### Validation
Use `express-validator` middleware in routes:

```javascript
import { body, param } from 'express-validator';
router.post('/', authenticate, [
  body('name').isLength({ min: 2, max: 100 }),
  body('category').isIn(['Primera', 'Segunda', 'Tercera']),
  param('id').isUUID()
], createCaddie);
```

## Database (Prisma + PostgreSQL)

- Import prisma from `src/config/database.js`
- Use `@map` for snake_case columns, `@@map` for snake_case tables
- Composite unique: use `findFirst`, not `findUnique`
- Always use transactions for multi-step operations

```javascript
// Composite unique check
const existing = await prisma.caddie.findFirst({ where: { number, category } });
// Transaction example
await prisma.$transaction([
  prisma.caddie.update({ where: { id }, data: { status } }),
  prisma.dispatchHistory.create({ data: { caddieId, previousStatus, newStatus } })
]);
```

## Authentication
- JWT: `Authorization: Bearer <token>`
- Admin routes: `authenticate` middleware
- Public routes: `optionalAuth`
- User attached to `req.user` after auth

## Environment Variables
```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
CORS_ORIGINS=http://localhost:5173,https://frontend.vercel.app
```

## Architecture
```
src/
├── config/         # database.js, websocket.js
├── controllers/    # Business logic
├── middleware/     # auth.js
├── routes/         # Express routes
├── utils/          # jwt.js, password.js, websocketEmitter.js
└── server.js       # Entry point
tests/              # *.test.js files
prisma/             # schema.prisma, seed.js
```

## API Endpoints
- `/api/auth/*` - Authentication
- `/api/caddies/*` - Caddie CRUD + PATCH /:id/status
- `/api/turns/*` - Golf turns
- `/api/attendance/*` - Daily attendance
- `/api/list-settings/*` - List configuration
- `/api/reports/*` - Reports
- `/api/messages/*` - Broadcast messages

## WebSocket Events
| Event | Payload |
|-------|---------|
| `caddie:status_changed` | `{caddieId, name, status, listNumber, timestamp}` |
| `caddie:added` | `{caddieId, name, listNumber, status, ...}` |
| `caddie:updated` | `{caddieId, updates, timestamp}` |
| `caddie:deleted` | `{caddieId, timestamp}` |
Rooms: `list-1`, `list-2`, `list-3`

## Git Commits
`type(scope): description` - `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

## Common Issues
1. **CORS**: Add origin to `CORS_ORIGINS`
2. **JWT**: Ensure `JWT_EXPIRES_IN=24h` (not quoted)
3. **PostgreSQL**: `DATABASE_URL` must be valid PostgreSQL connection string
4. **Prisma**: Run `npx prisma generate` after schema changes
5. **Tests**: Use `--testNamePattern` to filter by test name
6. **ESM**: Always use `.js` extensions in imports
