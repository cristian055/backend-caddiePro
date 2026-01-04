import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../src/server.js';
import { setupTestDatabase, cleanupTestDatabase, getAuthToken } from './utils/testHelpers.js';

describe('Caddies Endpoints', () => {
  let authToken;
  let testCaddieId;

  beforeAll(async () => {
    await setupTestDatabase();
    authToken = await getAuthToken(request(app));
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('GET /api/caddies', () => {
    test('should get all caddies without authentication', async () => {
      const response = await request(app).get('/api/caddies');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('listNumber');
      expect(response.body[0]).toHaveProperty('status');
    });

    test('should get all caddies with authentication', async () => {
      const response = await request(app)
        .get('/api/caddies')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/caddies/:id', () => {
    test('should get single caddie by ID', async () => {
      const response = await request(app).get('/api/caddies/test-caddie-1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('listNumber');
      expect(response.body).toHaveProperty('status');
      expect(response.body.name).toBe('Test Caddie 1');
    });

    test('should return 404 for non-existent caddie', async () => {
      const response = await request(app).get('/api/caddies/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/caddies/list/:listNumber', () => {
    test('should get caddies by list number', async () => {
      const response = await request(app).get('/api/caddies/list/1');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((caddie) => {
        expect(caddie.listNumber).toBe(1);
      });
    });

    test('should return empty array for list with no caddies', async () => {
      const response = await request(app).get('/api/caddies/list/99');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
  });

  describe('POST /api/caddies', () => {
    test('should create new caddie with authentication', async () => {
      const newCaddie = {
        name: 'New Test Caddie',
        listNumber: 1,
        phoneNumber: '+1234567890',
      };

      const response = await request(app)
        .post('/api/caddies')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newCaddie);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(newCaddie.name);
      expect(response.body.listNumber).toBe(newCaddie.listNumber);
      expect(response.body.phoneNumber).toBe(newCaddie.phoneNumber);

      testCaddieId = response.body.id;
    });

    test('should fail to create caddie without authentication', async () => {
      const newCaddie = {
        name: 'Unauthorized Caddie',
        listNumber: 1,
      };

      const response = await request(app).post('/api/caddies').send(newCaddie);

      expect(response.status).toBe(401);
    });

    test('should fail with missing required fields', async () => {
      const response = await request(app)
        .post('/api/caddies')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'No List' });

      expect(response.status).toBe(400);
    });

    test('should fail with invalid list number', async () => {
      const response = await request(app)
        .post('/api/caddies')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Invalid List', listNumber: 5 });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/caddies/:id', () => {
    test('should update caddie with authentication', async () => {
      const updates = {
        name: 'Updated Test Caddie',
        status: 'Ausente',
      };

      const response = await request(app)
        .put(`/api/caddies/${testCaddieId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe(updates.name);
      expect(response.body.status).toBe(updates.status);
    });

    test('should fail to update without authentication', async () => {
      const response = await request(app)
        .put(`/api/caddies/${testCaddieId}`)
        .send({ name: 'Should Fail' });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/caddies/:id', () => {
    test('should delete caddie with authentication', async () => {
      const response = await request(app)
        .delete(`/api/caddies/${testCaddieId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(204);
    });

    test('should fail to delete without authentication', async () => {
      const response = await request(app).delete('/api/caddies/test-caddie-1');

      expect(response.status).toBe(401);
    });

    test('should verify caddie was deleted', async () => {
      const response = await request(app).get(`/api/caddies/${testCaddieId}`);

      expect(response.status).toBe(404);
    });
  });
});
