import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create default admin
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.admin.upsert({
    where: { id: 'default-admin' },
    update: {},
    create: {
      id: 'default-admin',
      password: hashedPassword,
    },
  });
  console.log('Created admin user. Default password: admin123');

  // Create default list settings
  const lists = [1, 2, 3];
  for (const listNumber of lists) {
    await prisma.listSettings.upsert({
      where: { listNumber },
      update: {},
      create: {
        listNumber,
        callTime: '06:00',
        order: 'ascendente',
        rangeStart: 1,
        rangeEnd: 20,
      },
    });
    console.log(`Created list settings for List ${listNumber}`);

    // Create sample caddies for each list
    const sampleCaddies = [
      'Juan Pérez',
      'Carlos García',
      'Roberto López',
      'Miguel Martínez',
      'Antonio Sánchez',
      'Fernando González',
    ];

    for (let i = 0; i < sampleCaddies.length; i++) {
      const caddie = await prisma.caddie.upsert({
        where: { id: `caddie-${listNumber}-${i + 1}` },
        update: {},
        create: {
          id: `caddie-${listNumber}-${i + 1}`,
          name: sampleCaddies[i],
          listNumber,
          status: 'Disponible',
        },
      });

      // Create queue entry
      await prisma.caddieQueue.upsert({
        where: { caddieId: caddie.id },
        update: {},
        create: {
          caddieId: caddie.id,
          listNumber,
          position: i + 1,
          available: true,
        },
      });
    }
    console.log(`Created sample caddies for List ${listNumber}`);
  }

  // Create a welcome message
  await prisma.message.create({
    data: {
      content: '¡Bienvenido al sistema de gestión de Caddies! 🏌️‍♂️',
      targetList: null,
    },
  });
  console.log('Created welcome message');

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
