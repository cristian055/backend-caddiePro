import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../src/server.js';
import { setupTestDatabase, cleanupTestDatabase, getAuthToken } from './utils/testHelpers.js';

describe('Turns Endpoints', () => {
  let authToken;

  beforeAll(async () => {
    await setupTestDatabase();
    authToken = await getAuthToken(request(app));
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('GET /api/turns', () => {
    test('should get all turns', async () => {
      const response = await request(app).get('/api/turns');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/turns', () => {
    test('should create a new turn', async () => {
      const turnData = {
        caddieId: 'test-caddie-1',
        listNumber: 1,
      };

      const response = await request(app)
        .post('/api/turns')
        .set('Authorization', `Bearer ${authToken}`)
        .send(turnData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.caddieId).toBe(turnData.caddieId);
      expect(response.body.completed).toBe(false);
    });

    test('should fail without authentication', async () => {
      const response = await request(app)
        .post('/api/turns')
        .send({ caddieId: 'test-caddie-1', listNumber: 1 });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/turns/caddie/:caddieId', () => {
    test('should get turns by caddie', async () => {
      const response = await request(app).get('/api/turns/caddie/test-caddie-1');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/turns/list/:listNumber', () => {
    test('should get turns by list', async () => {
      const response = await request(app).get('/api/turns/list/1');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});

describe('Attendance Endpoints', () => {
  let authToken;

  beforeAll(async () => {
    await setupTestDatabase();
    authToken = await getAuthToken(request(app));
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('GET /api/attendance', () => {
    test('should get all attendance records', async () => {
      const response = await request(app).get('/api/attendance');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/attendance', () => {
    test('should create attendance record', async () => {
      const attendanceData = {
        caddieId: 'test-caddie-1',
        date: new Date().toISOString().split('T')[0],
        status: 'Presente',
      };

      const response = await request(app)
        .post('/api/attendance')
        .set('Authorization', `Bearer ${authToken}`)
        .send(attendanceData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe(attendanceData.status);
    });

    test('should fail with invalid status', async () => {
      const response = await request(app)
        .post('/api/attendance')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          caddieId: 'test-caddie-1',
          date: new Date().toISOString().split('T')[0],
          status: 'Invalid',
        });

      expect(response.status).toBe(400);
    });
  });
});

describe('List Settings Endpoints', () => {
  let authToken;

  beforeAll(async () => {
    await setupTestDatabase();
    authToken = await getAuthToken(request(app));
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('GET /api/list-settings', () => {
    test('should get all list settings', async () => {
      const response = await request(app).get('/api/list-settings');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3);
    });
  });

  describe('GET /api/list-settings/:listNumber/queue', () => {
    test('should get queue for list', async () => {
      const response = await request(app).get('/api/list-settings/1/queue');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('PUT /api/list-settings/:listNumber', () => {
    test('should update list settings', async () => {
      const response = await request(app)
        .put('/api/list-settings/1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ callTime: '07:00' });

      expect(response.status).toBe(200);
      expect(response.body.callTime).toBe('07:00');
    });
  });
});

describe('Reports Endpoints', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('GET /api/reports/daily/:date', () => {
    test('should get daily report', async () => {
      const date = new Date().toISOString().split('T')[0];
      const response = await request(app).get(`/api/reports/daily/${date}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('date');
      expect(response.body).toHaveProperty('records');
      expect(response.body).toHaveProperty('summary');
      expect(response.body.summary).toHaveProperty('totalCaddies');
      expect(response.body.summary).toHaveProperty('present');
      expect(response.body.summary).toHaveProperty('totalTurns');
    });
  });
});

describe('Messages Endpoints', () => {
  let authToken;
  let messageId;

  beforeAll(async () => {
    await setupTestDatabase();
    authToken = await getAuthToken(request(app));
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('GET /api/messages', () => {
    test('should get all messages', async () => {
      const response = await request(app).get('/api/messages');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/messages', () => {
    test('should create message', async () => {
      const messageData = {
        content: 'Test message from API',
        targetList: 1,
      };

      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send(messageData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe(messageData.content);
      expect(response.body.targetList).toBe(messageData.targetList);

      messageId = response.body.id;
    });
  });

  describe('GET /api/messages/:id/whatsapp', () => {
    test('should get WhatsApp URL', async () => {
      const response = await request(app).get(`/api/messages/${messageId}/whatsapp`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('whatsappUrl');
      expect(response.body.whatsappUrl).toContain('wa.me');
    });
  });

  describe('DELETE /api/messages/:id', () => {
    test('should delete message', async () => {
      const response = await request(app)
        .delete(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(204);
    });
  });
});
