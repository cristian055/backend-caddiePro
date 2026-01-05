# AGENTS.md - Development Guidelines for CaddiePro Backend

This document provides guidelines for AI agents and developers working on the CaddiePro backend API.

## Build, Lint, and Test Commands

### Running Tests
```bash
npm test                           # Run all tests
npm run test:watch                # Watch mode for development
npm run test:coverage             # With coverage report
npm run test:single tests/file.test.js    # Single file
npm run test:single -- --testNamePattern="should get"  # By pattern
```

### Database Commands
```bash
npm run prisma:generate    # Generate client after schema changes
npm run prisma:push        # Push schema (for development)
npm run prisma:migrate     # Create migrations (for production)
npm run prisma:studio      # Visual database editor
npm run prisma:seed        # Seed initial data
npm run reset:admin:force  # Reset admin password to admin123
```

### Development
```bash
npm run dev        # Hot reload development server
npm start          # Production server
npm run install:all  # Full setup: install + prisma + seed
```

## Code Style Guidelines

### Imports & File Naming
- Use ES modules (`import`/`export`)
- Order: external libs → internal → relative
- Named exports for controllers/utilities
- File naming: `*Controller.js`, `*.js` (routes), `*.test.js`

```javascript
// ✅ Correct order
import express from 'express';
import prisma from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
```

### Naming Conventions
- Variables/functions: `camelCase`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Model IDs: `PascalCase` (e.g., `Caddie`, `Turn`)

### Error Handling
- Always use try-catch in async controllers
- Log errors with context: `console.error('Action error:', error)`
- Consistent format: `{ error: 'message' }`
- Proper HTTP status codes

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

### HTTP Response Patterns
| Method | Success | Error |
|--------|---------|-------|
| GET | 200 | 404 |
| POST | 201 | 400, 409 |
| PUT | 200 | 400, 404 |
| DELETE | 204 | 404 |
| Auth | 200 | 401, 403 |

### Database Operations (Prisma + MongoDB)
- Import prisma from `src/config/database.js`
- MongoDB uses `@db.ObjectId` for relations
- Composite unique constraints use `findFirst`, not `findUnique`
- No `@index` in MongoDB schema

```javascript
// ✅ MongoDB composite unique check
const existing = await prisma.attendance.findFirst({
  where: {
    caddieId: caddieId,
    date: { gte: startDate, lt: endDate }
  }
});

// ❌ This syntax doesn't work in MongoDB
// where: { caddieId_date: { caddieId, date } }
```

### Authentication
- JWT tokens in Authorization header: `Bearer <token>`
- Admin routes: use `authenticate` middleware
- Public routes: use `optionalAuth`
- Use express-validator for input validation

```javascript
router.post('/caddies', authenticate,
  [body('name').notEmpty(), body('listNumber').isInt({ min: 1, max: 3 })],
  createCaddie
);
```

## Comments
- JSDoc for complex functions
- Document business logic decisions
- Keep comments synchronized with code

## Testing Guidelines
- Use `describe` for grouping, `test` for cases
- `beforeAll`/`afterAll` for setup/teardown
- Name: "should [action] when [condition]"
- Aim for >80% coverage

```javascript
test('should return 404 for non-existent caddie', async () => { ... });
test('should create turn and update caddie status', async () => { ... });
```

## Environment Variables

- Never commit `.env` files
- Use `.env.example` as template
- Access: `process.env.VARIABLE_NAME || default`

### Required Variables
```
DATABASE_URL=mongodb+srv://...
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
CORS_ORIGINS=http://localhost:5173,https://frontend.vercel.app
```

## Git Commit Guidelines

Conventional commits: `type(scope): description`
- `feat`: new feature
- `fix`: bug fix
- `refactor`: code restructure
- `test`: tests
- `docs`: documentation
- `chore`: maintenance

```
feat(auth): add JWT token refresh
fix(caddies): resolve queue calculation bug
docs: update API documentation
```

## Architecture Notes

### Service Structure
```
src/
├── config/         # Database, env config
├── controllers/    # Business logic
├── middleware/     # Auth, validation
├── routes/         # Express routes
├── utils/          # JWT, password helpers
└── server.js       # Entry point
```

### API Endpoints
- Auth: `/api/auth/*`
- Caddies: `/api/caddies/*`
- Turns: `/api/turns/*`
- Attendance: `/api/attendance/*`
- List Settings: `/api/list-settings/*`
- Reports: `/api/reports/*`
- Messages: `/api/messages/*`

### Database Models (MongoDB)
- `caddies` - Caddie information with queue relation
- `turns` - Golf turns/shifts
- `attendance` - Daily attendance records
- `caddie_queue` - Queue positions per list
- `list_settings` - List configuration (1, 2, 3)
- `messages` - Broadcast messages
- `admins` - Admin users

## Deployment (Vercel)

- Serverless functions (Express app)
- Set all env vars in Vercel Dashboard
- CORS_ORIGINS must include frontend URLs
- DATABASE_URL must include database name in path
- Redeploy after env var changes

## Common Issues

1. **CORS errors**: Add origin to CORS_ORIGINS env var
2. **JWT errors**: Ensure JWT_EXPIRES_IN is `"24h"` (string, not quoted in env)
3. **MongoDB connection**: DATABASE_URL must include database name: `/golfpro`
4. **Prisma errors**: Run `npx prisma generate` after schema changes
