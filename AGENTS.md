# AGENTS.md - CaddiePro Backend Guidelines

## Commands

```bash
# Tests
npm test                           # All tests
npm run test:single tests/file.test.js    # Single file
npm run test:single -- --testNamePattern="name"  # By pattern

# Database
npm run prisma:generate    # Regenerate client
npm run prisma:push        # Push schema (dev)
npm run prisma:seed        # Seed data
npm run reset:admin:force  # Reset admin password
npm run import:caddies     # Import from CSV

# Server
npm run dev    # Hot reload (port 3000)
npm start      # Production
```

## Code Style

### Imports & Files
- ES modules (`import`/`export`)
- Order: external libs → internal → relative
- Files: `*Controller.js`, `*.js` (routes), `*.test.js`

```javascript
import express from 'express';
import prisma from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
```

### Naming
- Variables/functions: `camelCase`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`

### Error Handling
```javascript
export const getCaddie = async (req, res) => {
  try {
    const caddie = await prisma.caddie.findUnique({
      where: { id: req.params.id }
    });
    if (!caddie) return res.status(404).json({ error: 'Not found' });
    res.json(caddie);
  } catch (error) {
    console.error('Get caddie error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
```

### HTTP Status Codes
| Method | Success | Error |
|--------|---------|-------|
| GET | 200 | 404 |
| POST | 201 | 400, 409 |
| PUT | 200 | 400, 404 |
| DELETE | 204 | 404 |

## Database (Prisma + MongoDB)

- Import prisma from `src/config/database.js`
- Composite unique: use `findFirst`, not `findUnique`
- No `@index` in MongoDB schema

```javascript
// MongoDB composite check
const existing = await prisma.attendance.findFirst({
  where: { caddieId, date: { gte: start, lt: end } }
});
```

## Authentication

- JWT: `Authorization: Bearer <token>`
- Admin routes: `authenticate` middleware
- Public routes: `optionalAuth`
- Validation: `express-validator`

## Environment Variables

```
DATABASE_URL=mongodb+srv://.../golfpro
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

`type(scope): description`
- `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

## Common Issues

1. **CORS**: Add origin to `CORS_ORIGINS`
2. **JWT**: Ensure `JWT_EXPIRES_IN=24h` (not quoted)
3. **MongoDB**: `DATABASE_URL` must include `/golfpro`
4. **Prisma**: Run `npx prisma generate` after schema changes
