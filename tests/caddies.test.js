import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../src/server.js';
import { setupTestDatabase, cleanupTestDatabase, getAuthToken } from './utils/testHelpers.js';

describe('Caddies Endpoints', () => {
  let authToken;
  let createdCaddies;

  beforeAll(async () => {
    const result = await setupTestDatabase();
    authToken = await getAuthToken(request(app));
    createdCaddies = result.createdCaddies;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('GET /api/caddies', () => {
    test('should get all caddies with authentication', async () => {
      const response = await request(app)
        .get('/api/caddies')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.caddies)).toBe(true);
      expect(response.body.data.caddies.length).toBeGreaterThan(0);
      expect(response.body.data.caddies[0]).toHaveProperty('id');
      expect(response.body.data.caddies[0]).toHaveProperty('name');
      expect(response.body.data.caddies[0]).toHaveProperty('category');
      expect(response.body.data.caddies[0]).toHaveProperty('status');
    });

    test('should fail without authentication', async () => {
      const response = await request(app).get('/api/caddies');
      expect(response.status).toBe(401);
    });

    test('should filter by category', async () => {
      const response = await request(app)
        .get('/api/caddies?category=Primera')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.caddies)).toBe(true);
      response.body.data.caddies.forEach((caddie) => {
        expect(caddie.category).toBe('Primera');
      });
    });

    test('should filter by activeStatus', async () => {
      const response = await request(app)
        .get('/api/caddies?activeStatus=Active')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.caddies)).toBe(true);
      response.body.data.caddies.forEach((caddie) => {
        expect(caddie.isActive).toBe(true);
      });
    });
  });

  describe('GET /api/caddies/:id', () => {
    test('should get single caddie by ID', async () => {
      const response = await request(app)
        .get(`/api/caddies/${createdCaddies[0].id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data).toHaveProperty('category');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data.name).toBe('Test Caddie 1');
    });

    test('should return 404 for non-existent caddie', async () => {
      const response = await request(app)
        .get('/api/caddies/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/caddies', () => {
    let newCaddieId;

    test('should create new caddie with authentication', async () => {
      const newCaddie = {
        name: 'New Test Caddie',
        number: 88,
        category: 'Primera',
        location: 'Llanogrande',
        role: 'Golf',
      };

      const response = await request(app)
        .post('/api/caddies')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newCaddie);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(newCaddie.name);
      expect(response.body.data.category).toBe(newCaddie.category);
      expect(response.body.data.number).toBe(newCaddie.number);

      newCaddieId = response.body.data.id;
    });

    test('should fail to create caddie without authentication', async () => {
      const newCaddie = {
        name: 'Unauthorized Caddie',
        number: 89,
        category: 'Primera',
        location: 'Llanogrande',
        role: 'Golf',
      };

      const response = await request(app).post('/api/caddies').send(newCaddie);

      expect(response.status).toBe(401);
    });

    test('should fail with missing required fields', async () => {
      const newCaddie = { name: 'No Category' };

      const response = await request(app)
        .post('/api/caddies')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newCaddie);

      expect(response.status).toBe(400);
    });

    test('should fail with invalid category', async () => {
      const newCaddie = {
        name: 'Invalid Category',
        number: 90,
        category: 'InvalidCategory',
        location: 'Llanogrande',
        role: 'Golf',
      };

      const response = await request(app)
        .post('/api/caddies')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newCaddie);

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/caddies/:id', () => {
    test('should update caddie with authentication', async () => {
      const updates = {
        name: 'Updated Test Caddie',
      };

      const response = await request(app)
        .put(`/api/caddies/${createdCaddies[0].id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ updates });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updates.name);
    });

    test('should fail to update without authentication', async () => {
      const response = await request(app)
        .put(`/api/caddies/${createdCaddies[0].id}`)
        .send({ updates: { name: 'Should Fail' } });

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/caddies/:id/status', () => {
    test('should update caddie status', async () => {
      const response = await request(app)
        .patch(`/api/caddies/${createdCaddies[0].id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'IN_PREP' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('IN_PREP');
    });

    test('should fail with invalid status', async () => {
      const response = await request(app)
        .patch(`/api/caddies/${createdCaddies[0].id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'INVALID_STATUS' });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/caddies/:id', () => {
    test('should deactivate caddie with authentication (soft delete)', async () => {
      const response = await request(app)
        .delete(`/api/caddies/${createdCaddies[0].id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Caddie deactivated successfully');
    });

    test('should fail to delete without authentication', async () => {
      const response = await request(app).delete(`/api/caddies/${createdCaddies[0].id}`);

      expect(response.status).toBe(401);
    });

    test('should still find caddie after soft delete but marked inactive', async () => {
      const response = await request(app)
        .get(`/api/caddies/${createdCaddies[0].id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.isActive).toBe(false);
    });
  });
});
