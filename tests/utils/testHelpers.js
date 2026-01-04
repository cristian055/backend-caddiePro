import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function setupTestDatabase() {
  // Clean up test data
  await prisma.turn.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.message.deleteMany();
  await prisma.caddieQueue.deleteMany();
  await prisma.caddie.deleteMany();
  await prisma.listSettings.deleteMany();
  await prisma.admin.deleteMany();

  // Create test admin
  const hashedPassword = await bcrypt.hash('test123', 10);
  await prisma.admin.create({
    data: {
      id: 'test-admin-id',
      password: hashedPassword,
    },
  });

  // Create test list settings
  for (let i = 1; i <= 3; i++) {
    await prisma.listSettings.create({
      data: {
        listNumber: i,
        callTime: '06:00',
        order: 'ascendente',
        rangeStart: 1,
        rangeEnd: 20,
      },
    });
  }

  // Create test caddies
  const testCaddies = [
    { name: 'Test Caddie 1', listNumber: 1, id: 'test-caddie-1' },
    { name: 'Test Caddie 2', listNumber: 1, id: 'test-caddie-2' },
    { name: 'Test Caddie 3', listNumber: 2, id: 'test-caddie-3' },
    { name: 'Test Caddie 4', listNumber: 2, id: 'test-caddie-4' },
    { name: 'Test Caddie 5', listNumber: 3, id: 'test-caddie-5' },
  ];

  for (const caddie of testCaddies) {
    await prisma.caddie.create({
      data: {
        id: caddie.id,
        name: caddie.name,
        listNumber: caddie.listNumber,
        status: 'Disponible',
      },
    });

    await prisma.caddieQueue.create({
      data: {
        caddieId: caddie.id,
        listNumber: caddie.listNumber,
        position: caddie.listNumber,
        available: true,
      },
    });
  }

  return { prisma };
}

export async function cleanupTestDatabase() {
  await prisma.turn.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.message.deleteMany();
  await prisma.caddieQueue.deleteMany();
  await prisma.caddie.deleteMany();
  await prisma.listSettings.deleteMany();
  await prisma.admin.deleteMany();
}

export async function getAuthToken(app) {
  const response = await app.post('/api/auth/login').send({ password: 'test123' });
  return response.body.token;
}

export { prisma };
