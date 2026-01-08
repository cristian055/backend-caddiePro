import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../src/server.js';
import { setupTestDatabase, cleanupTestDatabase } from './utils/testHelpers.js';

describe('Authentication Endpoints', () => {
  let authToken;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('POST /api/auth/login', () => {
    test('should login with correct email and password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'test123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe('admin@test.com');
      expect(typeof response.body.data.token).toBe('string');

      authToken = response.body.data.token;
    });

    test('should fail with incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    test('should fail with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'test123' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    test('should fail with missing email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ password: 'test123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    test('should fail with missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    test('should fail with empty body', async () => {
      const response = await request(app).post('/api/auth/login').send();

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out successfully');
    });

    test('should logout without token', async () => {
      const response = await request(app).post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out successfully');
    });
  });

  describe('GET /api/auth/verify', () => {
    test('should verify valid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.userId).toBeDefined();
    });

    test('should fail without token', async () => {
      const response = await request(app).get('/api/auth/verify');

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    test('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    test('should fail with malformed header', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', 'invalid-format');

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });
  });
});
