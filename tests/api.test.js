import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../src/server.js';
import { setupTestDatabase, cleanupTestDatabase, getAuthToken, prisma } from './utils/testHelpers.js';

// Run all API tests in a single suite to avoid connection issues
describe('API Endpoints', () => {
  let authToken;
  let messageId;

  beforeAll(async () => {
    await setupTestDatabase();
    authToken = await getAuthToken(request(app));
  }, 60000);

  afterAll(async () => {
    await cleanupTestDatabase();
  }, 60000);

  describe('List Endpoints', () => {
    test('GET /api/lists should get all list configurations with auth', async () => {
      const response = await request(app)
        .get('/api/lists')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('GET /api/lists should fail without authentication', async () => {
      const response = await request(app).get('/api/lists');
      expect(response.status).toBe(401);
    });

    test('GET /api/lists/:category should get list by category', async () => {
      const response = await request(app)
        .get('/api/lists/Primera')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.category).toBe('Primera');
    });

    test('GET /api/lists/:category should return 404 for non-existent', async () => {
      const response = await request(app)
        .get('/api/lists/NonExistent')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Messages Endpoints', () => {
    test('GET /api/messages should get all messages', async () => {
      const response = await request(app).get('/api/messages');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('POST /api/messages should create message with auth', async () => {
      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Test message', targetCategory: 'Primera' });

      expect(response.status).toBe(201);
      expect(response.body.content).toBe('Test message');
      messageId = response.body.id;
    });

    test('DELETE /api/messages/:id should delete message with auth', async () => {
      const response = await request(app)
        .delete(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(204);
    });
  });

  describe('Public Endpoints', () => {
    test('GET /api/public/queue should get public queue without auth', async () => {
      const response = await request(app).get('/api/public/queue');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('Caddie Queue Endpoint', () => {
    test('GET /api/caddies/queue should get caddie queue', async () => {
      const response = await request(app)
        .get('/api/caddies/queue')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Caddie Statistics Endpoint', () => {
    test('GET /api/caddies/statistics should get stats', async () => {
      const response = await request(app)
        .get('/api/caddies/statistics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });
});
