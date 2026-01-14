import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating queue positions for test caddies...\n');

  const caddies = await prisma.caddie.findMany({});

  console.log(`Found ${caddies.length} caddies\n`);

  for (const caddie of caddies) {
    const existing = await prisma.queuePosition.findFirst({
      where: { caddieId: caddie.id },
    });

    if (existing) {
      console.log(`⏭️  ${caddie.name} already has queue position: ${existing.position}`);
      continue;
    }

    const existingInCategory = await prisma.queuePosition.findFirst({
      where: { category: caddie.category },
      orderBy: { position: 'desc' },
    });

    const nextPosition = existingInCategory ? existingInCategory.position + 1 : 1;

    const queuePosition = await prisma.queuePosition.create({
      data: {
        caddieId: caddie.id,
        category: caddie.category,
        position: nextPosition,
        operationalStatus: 'AVAILABLE',
      },
    });

    console.log(`✅ Created queue position for ${caddie.name} (${caddie.category}): position ${queuePosition.position}`);
  }

  console.log('\n🎉 Queue positions created successfully!');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
