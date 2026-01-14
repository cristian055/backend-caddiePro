/**
 * Seed script for development with new schema
 * Creates test data matching the refactored architecture
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with test data...\n');

  // 1. Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@caddiepro.com' },
    update: {},
    create: {
      email: 'admin@caddiepro.com',
      passwordHash: '$2b$10$Ep.n5aK.zfKtPZ1G5Y5Z5O.5f5l.5f5f5f5f5f5f5f5f5f5f5', // 'password123'
      role: 'ADMIN',
      location: 'Llanogrande',
    },
  });
  console.log('✓ Created admin user');

  // 2. Create 5 test caddies
  const testCaddies = [
    { number: 1, name: 'Carlos García', category: 'PRIMERA', location: 'Llanogrande' },
    { number: 2, name: 'María López', category: 'PRIMERA', location: 'Llanogrande' },
    { number: 3, name: 'Juan Pérez', category: 'SEGUNDA', location: 'Llanogrande' },
    { number: 4, name: 'Ana Martínez', category: 'SEGUNDA', location: 'Llanogrande' },
    { number: 5, name: 'Pedro Rodríguez', category: 'TERCERA', location: 'Llanogrande' },
  ];

  const createdCaddies = [];

  for (const caddieData of testCaddies) {
    const caddie = await prisma.caddie.create({
      data: {
        number: caddieData.number,
        name: caddieData.name,
        category: caddieData.category,
        location: caddieData.location,
        role: 'GOLF',
        isActive: true,
      },
    });
    createdCaddies.push(caddie);
    console.log(`✓ Created caddie: ${caddie.name} (#${caddie.number})`);
  }

  // 3. Create queue positions for each caddie (positions reset per category)
  const categoryPositions = { PRIMERA: 0, SEGUNDA: 0, TERCERA: 0 };

  for (const caddie of createdCaddies) {
    const currentCategory = caddie.category;
    categoryPositions[currentCategory]++;
    const position = categoryPositions[currentCategory];
    
    await prisma.queuePosition.create({
      data: {
        caddieId: caddie.id,
        category: caddie.category,
        position: position,
        operationalStatus: 'AVAILABLE',
      },
    });
    console.log(`✓ Created queue position: ${caddie.category} position ${position}`);
  }

  // 4. Create list configs
  const categories = ['PRIMERA', 'SEGUNDA', 'TERCERA'];
  for (const category of categories) {
    await prisma.listConfig.create({
      data: {
        name: `${category} Queue`,
        category: category,
        location: 'Llanogrande',
        rangeStart: 1,
        rangeEnd: 10,
        orderType: 'ASC',
      },
    });
    console.log(`✓ Created list config: ${category}`);
  }

  // 5. Create daily attendance for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const caddie of createdCaddies) {
    await prisma.dailyAttendance.create({
      data: {
        caddieId: caddie.id,
        date: today,
        status: 'PRESENT',
        arrivalTime: today,
        servicesCount: 0,
      },
    });
  }
  console.log(`✓ Created daily attendance records for ${createdCaddies.length} caddies`);

  console.log('\n✅ Seeding completed successfully');
  console.log('\n📊 Summary:');
  console.log(`  - Users: 1 (admin)`);
  console.log(`  - Caddies: ${createdCaddies.length}`);
  console.log(`  - Queue positions: ${createdCaddies.length}`);
  console.log(`  - List configs: ${categories.length}`);
  console.log(`  - Daily attendance: ${createdCaddies.length}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('\n❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
