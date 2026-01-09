import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...\n');

  // ============================================
  // Create default admin user
  // ============================================
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@campestre.com' },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: 'admin@campestre.com',
        passwordHash: hashedPassword,
        role: 'admin',
        location: 'Llanogrande',
        isActive: true,
      },
    });
    console.log('✅ Created admin user:');
    console.log('   Email: admin@campestre.com');
    console.log('   Password: admin123');
    console.log('   Role: admin');
  } else {
    console.log('⏭️  Admin user already exists');
  }

  // ============================================
  // Create default list configurations
  // ============================================
  const listDefaults = [
    { category: 'Primera', name: 'Lista Primera', rangeStart: 1, rangeEnd: 60 },
    { category: 'Segunda', name: 'Lista Segunda', rangeStart: 1, rangeEnd: 30 },
    { category: 'Tercera', name: 'Lista Tercera', rangeStart: 1, rangeEnd: 25 },
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
  // Create sample caddies (only if no caddies exist)
  // ============================================
  const caddieCount = await prisma.caddie.count();
  
  if (caddieCount === 0) {
    console.log('\n👤 Creating sample caddies...');
    
    const sampleCaddies = [
      { name: 'Test Caddie 1', number: 1, category: 'Primera' },
      { name: 'Test Caddie 2', number: 2, category: 'Primera' },
      { name: 'Test Caddie 3', number: 1, category: 'Segunda' },
      { name: 'Test Caddie 4', number: 2, category: 'Segunda' },
      { name: 'Test Caddie 5', number: 1, category: 'Tercera' },
      { name: 'Test Caddie 6', number: 2, category: 'Tercera' },
    ];

    for (const caddie of sampleCaddies) {
      await prisma.caddie.create({
        data: {
          name: caddie.name,
          number: caddie.number,
          category: caddie.category,
          status: 'AVAILABLE',
          isActive: true,
          location: 'Llanogrande',
          role: 'Golf',
          weekendPriority: caddie.number,
        },
      });
      console.log(`   ✅ Created: ${caddie.name} (${caddie.category})`);
    }
  } else {
    console.log(`\n⏭️  ${caddieCount} caddies already exist, skipping sample data`);
  }

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
