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
# Generate Prisma client
npm run prisma:generate

# Push schema changes to database
npm run prisma:push

# Create and run migrations
npm run prisma:migrate

# Open Prisma Studio (visual database browser)
npm run prisma:studio

# Seed database with initial data
npm run prisma:seed
```

### Development Commands
```bash
# Start development server with hot reload
npm run dev

# Start production server
npm start

# Full setup (install, generate client, push schema, seed)
npm run install:all
```

## Project Structure

```
backend-caddiePro/
├── prisma/
│   ├── schema.prisma      # Database schema definition
│   └── seed.js            # Database seeding script
├── src/
│   ├── config/
│   │   └── database.js    # Prisma client instance
│   ├── controllers/       # Route handlers (business logic)
│   ├── middleware/
│   │   └── auth.js       # Authentication middleware
│   ├── routes/           # Express route definitions
│   ├── utils/            # Utility functions
│   └── server.js         # Application entry point
├── tests/
│   ├── utils/            # Test helpers and fixtures
│   ├── *.test.js         # Test files
└── jest.config.js        # Jest configuration
```

## Code Style Guidelines

### Imports
- Use ES module syntax (`import`/`export`)
- Group imports: external libs, internal modules, relative paths
- Use absolute imports from `src/` where possible
- Named exports preferred over default exports

```javascript
// ✅ Good
import express from 'express';
import { Router } from 'express';
import prisma from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { getAllCaddies } from '../controllers/caddieController.js';

// ❌ Avoid
import express from 'express';
import { Router } from 'express';
import * as prisma from '../config/database.js';
```

### File Naming
- Controllers: `*Controller.js` (e.g., `caddieController.js`)
- Routes: `*.js` matching the resource (e.g., `caddie.js`)
- Utilities: `*.js` (e.g., `jwt.js`, `password.js`)
- Test files: `*.test.js` (e.g., `caddies.test.js`)

### Variable Naming
- **camelCase** for variables and functions: `getCaddieById`, `userId`
- **PascalCase** for classes and constructors: `DatabaseClient`, `AuthService`
- **UPPER_SNAKE_CASE** for constants: `JWT_SECRET`, `API_PORT`

### Error Handling
- Always handle errors in async functions with try-catch
- Use consistent error response format: `{ error: string }`
- Log errors with context for debugging
- Return appropriate HTTP status codes

```javascript
// ✅ Good error handling
export const createCaddie = async (req, res) => {
  try {
    const { name, listNumber } = req.body;
    const caddie = await prisma.caddie.create({ data: { name, listNumber } });
    res.status(201).json(caddie);
  } catch (error) {
    console.error('Create caddie error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ❌ Avoid - no error handling
export const createCaddie = async (req, res) => {
  const caddie = await prisma.caddie.create(req.body);
  res.json(caddie);
};
```

### HTTP Response Patterns
- **GET**: Return 200 with data, 404 if not found
- **POST**: Return 201 with created resource, 400 for validation errors
- **PUT**: Return 200 with updated resource, 404 if not found
- **DELETE**: Return 204 (no content) on success, 404 if not found
- **Authentication**: Return 401 if unauthorized, 403 if forbidden

### Database Queries
- Use Prisma Client for all database operations
- Always handle potential null returns with proper checks
- Use transactions for multi-step operations that must succeed together
- Include error handling for database connection issues

```javascript
// ✅ Good - with null check
export const getCaddieById = async (req, res) => {
  const caddie = await prisma.caddie.findUnique({ where: { id: req.params.id } });
  if (!caddie) {
    return res.status(404).json({ error: 'Caddie not found' });
  }
  res.json(caddie);
};

// ✅ Good - with transaction
export const transferCaddie = async (req, res) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Multiple operations
      const caddie = await tx.caddie.update({ ... });
      await tx.caddieQueue.update({ ... });
      return caddie;
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Transaction failed' });
  }
};
```

### Authentication & Authorization
- Use JWT tokens for authentication
- Protect admin routes with `authenticate` middleware
- Use `optionalAuth` for routes that work with or without auth
- Validate tokens on every protected route

```javascript
// ✅ Protected admin route
router.post('/caddies', authenticate, createCaddie);

// ✅ Public route (no auth required)
router.get('/caddies', optionalAuth, getAllCaddies);
```

### Validation
- Use express-validator for request validation
- Validate input before processing
- Provide clear error messages for validation failures

```javascript
// ✅ Good - with validation
router.post('/caddies',
  authenticate,
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('listNumber').isIn(['1', '2', '3']).withMessage('Invalid list number'),
  ],
  createCaddie
);
```

### Async/Await
- Always use `async`/`await` for asynchronous operations
- Avoid mixing promises and async/await
- Use try-catch blocks to handle errors

### Comments and Documentation
- Add JSDoc comments for functions with complex logic
- Document non-obvious business logic
- Keep comments up-to-date with code changes

```javascript
/**
 * Moves a caddie to the end of the queue as a penalty for late arrival.
 * This is called when attendance status is "Llegó tarde".
 * @param {string} caddieId - The ID of the caddie to move
 */
async function moveCaddieToEndOfQueue(caddieId) {
  // Implementation...
}
```

## Testing Guidelines

### Test Structure
- Use `describe` blocks to group related tests
- Use `test` (or `it`) for individual test cases
- Use `beforeAll`/`afterAll` for setup/teardown
- Use `beforeEach`/`afterEach` when needed

```javascript
describe('Caddies Endpoints', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  test('should get all caddies', async () => {
    // Test implementation
  });
});
```

### Test Naming
- Start with "should" followed by expected behavior
- Be descriptive about what is being tested
- Use the pattern: "should [action] when [condition]"

```javascript
// ✅ Good test names
test('should get all caddies', async () => { ... });
test('should return 404 for non-existent caddie', async () => { ... });
test('should fail to create caddie without authentication', async () => { ... });
```

### Test Coverage
- Aim for >80% coverage on core functionality
- Test both success and error paths
- Test edge cases and boundary conditions
- Test database operations

## Prisma Best Practices

- Always use the Prisma Client singleton from `src/config/database.js`
- Run `npm run prisma:generate` after schema changes
- Use type-safe queries with TypeScript when possible
- Use Prisma Studio to inspect data: `npm run prisma:studio`

## Environment Variables

- Never commit `.env` files (it's in .gitignore)
- Use `.env.example` as a template
- All environment variables must be prefixed with `process.env.`
- Define defaults in code for non-sensitive values

```javascript
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
```

## Git Commit Guidelines

- Use conventional commit format: `type(scope): description`
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
- Keep commits atomic and focused
- Write commit messages in English

```
feat(auth): add JWT token refresh endpoint
fix(caddies): resolve queue position calculation bug
test: add database connection tests
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
import { getAllX, getXById } from '../controllers/xController.js';

const router = Router();
router.get('/', optionalAuth, getAllX);
router.get('/:id', optionalAuth, getXById);
router.post('/', authenticate, createX);
export default router;
```

## Notes

- Server runs on port 3000 by default
- Health check available at `GET /health`
- CORS is enabled for all origins (restrict in production)
- All routes are prefixed with `/api`
- Default admin password is `admin123` (change in production)
