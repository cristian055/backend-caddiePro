import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

const CATEGORY_MAP = {
  'Primera': 'PRIMERA',
  'Segunda': 'SEGUNDA',
  'Tercera': 'TERCERA'
};

function parseCaddiesCSV() {
  const csvPath = path.join(__dirname, '..', 'load_data', 'caddies.csv');

  if (!fs.existsSync(csvPath)) {
    console.warn(`   ⚠️  CSV file not found: ${csvPath}`);
    return [];
  }

  const content = fs.readFileSync(csvPath, 'utf-8');

  return content
    .split('\n')
    .slice(1)
    .filter(line => line.trim())
    .map(line => {
      const parts = line.split(',');
      if (parts.length < 2) return null;
      const name = parts[0].replace(/^"|"$/g, '').trim();
      const lista = parts[1].replace(/^"|"$/g, '').trim();
      return { name, lista };
    })
    .filter(Boolean);
}

async function seedCaddiesFromCSV() {
  const caddieRecords = parseCaddiesCSV();

  if (caddieRecords.length === 0) {
    console.log('\n⏭️  No caddies found in CSV');
    return { createdCaddies: 0, createdPositions: 0 };
  }

  console.log(`\n📥 Found ${caddieRecords.length} caddies in CSV`);

  const categoryCounters = { PRIMERA: 0, SEGUNDA: 0, TERCERA: 0 };
  let createdCaddies = 0;
  let createdPositions = 0;

  for (const record of caddieRecords) {
    const categoryEnum = CATEGORY_MAP[record.lista];

    if (!categoryEnum) {
      console.warn(`   ⚠️  Unknown category: ${record.lista} for ${record.name}`);
      continue;
    }

    const existingCaddie = await prisma.caddie.findFirst({
      where: { name: record.name }
    });

    if (existingCaddie) {
      console.log(`   ⏭️  Skipped (exists): ${record.name}`);
      categoryCounters[categoryEnum]++;
      continue;
    }

    const number = ++categoryCounters[categoryEnum];

    const caddie = await prisma.caddie.create({
      data: {
        name: record.name,
        number,
        category: categoryEnum,
        isActive: true,
        location: 'Llanogrande',
        role: 'GOLF',
        weekendPriority: number,
      }
    });
    createdCaddies++;

    await prisma.queuePosition.create({
      data: {
        caddieId: caddie.id,
        category: categoryEnum,
        position: number,
        operationalStatus: 'AVAILABLE',
      }
    });
    createdPositions++;
  }

  console.log(`   ✅ Created ${createdCaddies} caddies`);
  console.log(`   ✅ Created ${createdPositions} queue positions`);

  return { createdCaddies, createdPositions };
}

async function main() {
  console.log('Starting seed...\n');

  // ============================================
  // Create default admin user
  // ============================================
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@campestre.com' },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('Admin123#', 10);
    const admin = await prisma.user.create({
      data: {
        email: 'admin@campestre.com',
        passwordHash: hashedPassword,
        role: 'ADMIN',
        location: 'Llanogrande',
        isActive: true,
      },
    });
    console.log('✅ Created admin user:');
    console.log('   Email: admin@campestre.com');
    console.log('   Password: Admin123#');
    console.log('   Role: admin');
  } else {
    console.log('⏭️  Admin user already exists');
  }

  // ============================================
  // Create default list configurations
  // ============================================
  const listDefaults = [
    { category: 'PRIMERA', name: 'Lista Primera', rangeStart: 1, rangeEnd: 60 },
    { category: 'SEGUNDA', name: 'Lista Segunda', rangeStart: 1, rangeEnd: 30 },
    { category: 'TERCERA', name: 'Lista Tercera', rangeStart: 1, rangeEnd: 25 },
  ];

  console.log('\n📋 Checking list configurations...');
  for (const listDef of listDefaults) {
    const existing = await prisma.listConfig.findFirst({
      where: { category: listDef.category },
    });

    if (!existing) {
      await prisma.listConfig.create({
        data: {
          name: listDef.name,
          category: listDef.category,
          location: 'Llanogrande',
          rangeStart: listDef.rangeStart,
          rangeEnd: listDef.rangeEnd,
          orderType: 'ASC',
        },
      });
      console.log(`   ✅ Created: ${listDef.name}`);
    } else {
      console.log(`   ⏭️  Already exists: ${listDef.category}`);
    }
  }

  // ============================================
  // Load caddies from CSV with QueuePosition
  // ============================================
  await seedCaddiesFromCSV();

  // ============================================
  // Create welcome message
  // ============================================
  const messageCount = await prisma.message.count();
  if (messageCount === 0) {
    await prisma.message.create({
      data: {
        content: '¡Bienvenido al sistema de gestión de Caddies!',
        targetCategory: null,
      },
    });
    console.log('\n✅ Created welcome message');
  }

  console.log('\n🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
