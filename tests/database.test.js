import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../src/config/database.js';

describe('Database Connection Tests', () => {
  beforeAll(async () => {
    // Test will fail if connection cannot be established
    try {
      await prisma.$connect();
      console.log('✅ Database connected successfully');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should successfully connect to database', async () => {
    // Simple query to test connection
    const result = await prisma.$queryRaw`SELECT 1 as result`;
    expect(result).toBeDefined();
    expect(result[0].result).toBe(1);
  });

  test('should be able to query database', async () => {
    const adminCount = await prisma.admin.count();
    expect(typeof adminCount).toBe('number');
    expect(adminCount).toBeGreaterThanOrEqual(0);
  });

  test('should have all required tables', async () => {
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;

    const tableNames = tables.map((t) => t.table_name);

    const requiredTables = [
      'Caddie',
      'Turn',
      'Attendance',
      'ListSettings',
      'Message',
      'CaddieQueue',
      'Admin',
    ];

    requiredTables.forEach((table) => {
      expect(tableNames).toContain(table);
    });
  });

  test('should be able to create and query a record', async () => {
    // Create a test message
    const message = await prisma.message.create({
      data: {
        content: 'Test message',
        targetList: null,
      },
    });

    expect(message).toBeDefined();
    expect(message.id).toBeDefined();
    expect(message.content).toBe('Test message');

    // Query the message
    const found = await prisma.message.findUnique({
      where: { id: message.id },
    });

    expect(found).toBeDefined();
    expect(found.content).toBe('Test message');

    // Cleanup
    await prisma.message.delete({ where: { id: message.id } });
  });

  test('should handle database errors gracefully', async () => {
    // Try to find a non-existent record
    const result = await prisma.caddie.findUnique({
      where: { id: 'non-existent-id' },
    });

    expect(result).toBeNull();
  });

  test('should support transactions', async () => {
    await prisma.$transaction(async (tx) => {
      // Create a caddie
      const caddie = await tx.caddie.create({
        data: {
          name: 'Transaction Test Caddie',
          listNumber: 1,
          status: 'Disponible',
        },
      });

      expect(caddie).toBeDefined();
      expect(caddie.id).toBeDefined();

      // Create queue entry
      await tx.caddieQueue.create({
        data: {
          caddieId: caddie.id,
          listNumber: 1,
          position: 999,
          available: true,
        },
      });

      // Rollback the transaction
      throw new Error('Rollback test');
    }).catch(() => {
      // Expected to fail
    });

    // Verify rollback
    const caddie = await prisma.caddie.findFirst({
      where: { name: 'Transaction Test Caddie' },
    });

    expect(caddie).toBeNull();
  });
});
