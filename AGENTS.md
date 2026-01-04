# AGENTS.md - Development Guidelines for CaddiePro Backend

This document provides guidelines for AI agents and developers working on the CaddiePro backend API.

## Build, Lint, and Test Commands

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run a single test file
npm run test:single tests/database.test.js

# Run specific test by name
npm run test:single -- --testNamePattern="should connect to database"
```

### Database Commands
```bash
npm run prisma:generate    # Generate Prisma client
npm run prisma:push        # Push schema to database
npm run prisma:migrate      # Create migrations
npm run prisma:studio      # Visual database browser
npm run prisma:seed        # Seed database
npm run reset:admin        # Check admin status
npm run reset:admin:force  # Reset admin password to "admin123"
```

### Development Commands
```bash
npm run dev        # Development with hot reload
npm start           # Production server
npm run install:all # Full setup
```

## Code Style Guidelines

### Imports & File Naming
- Use ES modules: `import`/`export`
- Group: external libs → internal → relative
- Named exports preferred
- Controllers: `*Controller.js`, Routes: `*.js`, Tests: `*.test.js`
- Variable naming: `camelCase` (functions), `PascalCase` (classes), `UPPER_SNAKE_CASE` (constants)

```javascript
// ✅ Good
import express from 'express';
import prisma from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
```

### Error Handling
- Always use try-catch in async functions
- Consistent error format: `{ error: string }`
- Log errors with context
- Return proper HTTP status codes

```javascript
export const createX = async (req, res) => {
  try {
    const result = await prisma.x.create({ data: req.body });
    res.status(201).json(result);
  } catch (error) {
    console.error('Create X error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
```

### HTTP Response Patterns
- GET: 200 (data), 404 (not found)
- POST: 201 (created), 400 (validation)
- PUT: 200 (updated), 404 (not found)
- DELETE: 204 (no content), 404 (not found)
- Auth: 401 (unauthorized), 403 (forbidden)

### Database Operations
- Use Prisma Client from `src/config/database.js`
- Handle null returns with checks
- Use transactions for multi-step operations
- Run `npm run prisma:generate` after schema changes

```javascript
// ✅ With null check
const caddie = await prisma.caddie.findUnique({ where: { id: req.params.id } });
if (!caddie) return res.status(404).json({ error: 'Not found' });
res.json(caddie);

// ✅ Transaction
await prisma.$transaction(async (tx) => {
  await tx.caddie.update({ ... });
  await tx.caddieQueue.update({ ... });
});
```

### Authentication & Validation
- JWT tokens for auth
- Protect admin routes with `authenticate` middleware
- Public routes use `optionalAuth`
- Use express-validator for input validation

```javascript
router.post('/caddies', authenticate,
  [body('name').notEmpty(), body('listNumber').isIn(['1','2','3'])],
  createCaddie
);
```

### Comments
- JSDoc for complex functions
- Document non-obvious business logic
- Keep comments up-to-date

## Testing Guidelines

### Test Structure
- `describe` to group tests, `test` for cases
- `beforeAll`/`afterAll` for setup/teardown
- Aim for >80% coverage

### Test Naming
- Pattern: "should [action] when [condition]"
- Be descriptive

```javascript
test('should get all caddies', async () => { ... });
test('should return 404 for non-existent caddie', async () => { ... });
```

## Environment Variables

- Never commit `.env`
- Use `.env.example` as template
- Use `process.env.VARIABLE_NAME || default`

## Git Commit Guidelines

Conventional commits: `type(scope): description`
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
- Atomic, focused commits
- Messages in English

```
feat(auth): add JWT token refresh
fix(caddies): resolve queue calculation bug
test: add database tests
docs: update API documentation
```

## Common Patterns

### Controller Pattern
```javascript
export const getAllX = async (req, res) => {
  try {
    const result = await prisma.x.findMany();
    res.json(result);
  } catch (error) {
    console.error('Get X error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
```

### Route Pattern
```javascript
import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();
router.get('/', optionalAuth, getAllX);
router.post('/', authenticate, createX);
export default router;
```

## Notes

- Server: port 3000, health check at `GET /health`
- CORS enabled (restrict in production)
- Default admin password: `admin123` (change in production)
- Run `npm run prisma:studio` to inspect database
