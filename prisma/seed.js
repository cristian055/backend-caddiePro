import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create default admin - MongoDB generates ObjectId automatically
  // Check if admin already exists
  const existingAdmin = await prisma.admin.findFirst();
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.admin.create({
      data: {
        password: hashedPassword,
      },
    });
    console.log('Created admin user. Default password: admin123');
    console.log('Admin ID:', admin.id);
  } else {
    console.log('Admin already exists');
  }

  // Create default list settings
  const lists = [1, 2, 3];
  for (const listNumber of lists) {
    const existingSettings = await prisma.listSettings.findUnique({
      where: { listNumber },
    });

    if (!existingSettings) {
      await prisma.listSettings.create({
        data: {
          listNumber,
          callTime: '06:00',
          order: 'ascendente',
          rangeStart: 1,
          rangeEnd: 20,
        },
      });
      console.log(`Created list settings for List ${listNumber}`);
    } else {
      console.log(`List settings for List ${listNumber} already exists`);
    }

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
      const caddie = await prisma.caddie.create({
        data: {
          name: sampleCaddies[i],
          listNumber,
          status: 'Disponible',
        },
      });

      // Create queue entry
      await prisma.caddieQueue.create({
        data: {
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
  const messageCount = await prisma.message.count();
  if (messageCount === 0) {
    await prisma.message.create({
      data: {
        content: '¡Bienvenido al sistema de gestión de Caddies! 🏌️‍♂️',
        targetList: null,
      },
    });
    console.log('Created welcome message');
  } else {
    console.log('Messages already exist');
  }

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
