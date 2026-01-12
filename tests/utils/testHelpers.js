import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function setupTestDatabase() {
  // Clean up test data - order matters due to foreign keys
  await prisma.dispatchHistory.deleteMany();
  await prisma.serviceLog.deleteMany();
  await prisma.weeklyAssignment.deleteMany();
  await prisma.weeklyShiftRequirement.deleteMany();
  await prisma.weeklyShift.deleteMany();
  await prisma.caddieAvailability.deleteMany();
  await prisma.message.deleteMany();
  await prisma.caddie.deleteMany();
  await prisma.listConfig.deleteMany();
  await prisma.user.deleteMany();

  // Create test admin user
  const hashedPassword = await bcrypt.hash('test123', 10);
  await prisma.user.create({
    data: {
      email: 'admin@test.com',
      passwordHash: hashedPassword,
      role: 'admin',
      location: 'Llanogrande',
    },
  });

  // Create test list configs
  const categories = ['Primera', 'Segunda', 'Tercera'];
  for (let i = 0; i < categories.length; i++) {
    await prisma.listConfig.create({
      data: {
        name: `Lista ${categories[i]}`,
        category: categories[i],
        location: 'Llanogrande',
        orderType: 'ASC',
        rangeStart: 1,
        rangeEnd: 20,
      },
    });
  }

  // Create test caddies
  const testCaddies = [
    { name: 'Test Caddie 1', number: 1, category: 'Primera' },
    { name: 'Test Caddie 2', number: 2, category: 'Primera' },
    { name: 'Test Caddie 3', number: 1, category: 'Segunda' },
    { name: 'Test Caddie 4', number: 2, category: 'Segunda' },
    { name: 'Test Caddie 5', number: 1, category: 'Tercera' },
  ];

  for (const caddie of testCaddies) {
    await prisma.caddie.create({
      data: {
        name: caddie.name,
        number: caddie.number,
        category: caddie.category,
        status: 'AVAILABLE',
        location: 'Llanogrande',
        role: 'Golf',
        weekendPriority: caddie.number,
      },
    });
  }

  return { prisma };
}

export async function cleanupTestDatabase() {
  await prisma.dispatchHistory.deleteMany();
  await prisma.serviceLog.deleteMany();
  await prisma.weeklyAssignment.deleteMany();
  await prisma.weeklyShiftRequirement.deleteMany();
  await prisma.weeklyShift.deleteMany();
  await prisma.caddieAvailability.deleteMany();
  await prisma.message.deleteMany();
  await prisma.caddie.deleteMany();
  await prisma.listConfig.deleteMany();
  await prisma.user.deleteMany();
}

export async function getAuthToken(app) {
  const response = await app.post('/api/auth/login').send({ 
    email: 'admin@test.com',
    password: 'test123' 
  });
  return response.body.data?.token || response.body.token;
}

export { prisma };
