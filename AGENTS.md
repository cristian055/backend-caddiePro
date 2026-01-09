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
npm run test:single -- --testNamePattern="name" # Run by test name

# Database (Prisma)
npm run prisma:generate             # Regenerate Prisma client
npm run prisma:push                 # Push schema changes (dev)
npm run prisma:seed                 # Seed database
npm run import:caddies              # Import caddies from CSV
npm run reset:admin:force           # Reset admin password

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
// Success: res.status(200).json({ success: true, data: {...}, message: 'Optional' });
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
```

## API Endpoints

**Public (No Auth)**: `GET /api/public/queue`, `GET /api/public/lists`, `GET /api/public/lists/:listNumber`

**Admin (Auth Required)**: `POST /api/auth/login`, `GET/POST/PUT/DELETE /api/caddies`, `PATCH /api/caddies/:id/status`, `POST /api/dispatch/bulk`, `GET/POST /api/lists`, `GET /api/attendance/*`, `GET /api/reports/*`

## WebSocket

**Emitted Events**: `caddie:status_changed`, `caddie:added`, `caddie:updated`, `caddie:deleted`, `caddie:dispatched`, `queue:updated`

**Payload**: `{ event, data: {...}, timestamp }` - nested data for frontend compatibility

**Rooms**: `list-1` (Primera), `list-2` (Segunda), `list-3` (Tercera)

**Client Events**: `subscribe` (join rooms), `unsubscribe` (leave rooms), `ping/pong` (health check)

**Auth**: Public users connect without token. Use `?lists=1,2,3` query param or `subscribe` event.

## Git Commits
Format: `type(scope): description` - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

Examples: `feat(caddies): add bulk dispatch endpoint` | `fix(auth): resolve token expiration issue`

## Common Issues
1. **CORS** - Add origin to `CORS_ORIGINS` env var
2. **JWT** - Ensure `JWT_EXPIRES_IN=24h` (no quotes)
3. **PostgreSQL** - `DATABASE_URL` must be valid connection string
4. **Prisma** - Run `npm run prisma:generate` after schema changes
5. **Tests** - Use `--testNamePattern` to filter by test name
6. **ESM** - Always use `.js` extensions in imports
7. **WebSocket** - Check CORS allows WebSocket connections
