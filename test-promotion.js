import { PrismaClient } from '@prisma/client';
import { categoryPromotionService } from './src/services/categoryPromotionService.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Testing category promotion...\n');

  // Get a TERCERA caddie
  const terceraCaddie = await prisma.caddie.findFirst({
    where: { category: 'TERCERA' },
    include: { queuePosition: true },
  });

  if (!terceraCaddie) {
    console.log('No TERCERA caddie found');
    return;
  }

  console.log('Caddie before promotion:');
  console.log(`  Name: ${terceraCaddie.name}`);
  console.log(`  Category: ${terceraCaddie.category}`);
  console.log(`  Position: ${terceraCaddie.queuePosition?.position}`);
  console.log(`  Queue Status: ${terceraCaddie.queuePosition?.operationalStatus}`);
  console.log('');

  // Promote to SEGUNDA
  console.log(`Promoting ${terceraCaddie.name} from TERCERA to SEGUNDA...`);
  const result = await categoryPromotionService.promoteCaddie(
    terceraCaddie.id,
    terceraCaddie.category,
    'SEGUNDA'
  );

  console.log('Promotion result:', JSON.stringify(result, null, 2));
  console.log('');

  // Get the updated caddie
  const updatedCaddie = await prisma.caddie.findUnique({
    where: { id: terceraCaddie.id },
    include: { queuePosition: true },
  });

  console.log('Caddie after promotion:');
  console.log(`  Name: ${updatedCaddie.name}`);
  console.log(`  Category: ${updatedCaddie.category}`);
  console.log(`  Position: ${updatedCaddie.queuePosition?.position}`);
  console.log(`  Queue Status: ${updatedCaddie.queuePosition?.operationalStatus}`);
  console.log('');

  // Show all TERCERA positions
  const terceraPositions = await prisma.queuePosition.findMany({
    where: { category: 'TERCERA' },
    include: { caddie: { select: { name: true } } },
    orderBy: { position: 'asc' },
  });
  console.log('TERCERA queue positions after promotion:');
  terceraPositions.forEach(qp => {
    console.log(`  ${qp.position}. ${qp.caddie.name} (${qp.operationalStatus})`);
  });
  console.log('');

  // Show all SEGUNDA positions
  const segundaPositions = await prisma.queuePosition.findMany({
    where: { category: 'SEGUNDA' },
    include: { caddie: { select: { name: true } } },
    orderBy: { position: 'asc' },
  });
  console.log('SEGUNDA queue positions after promotion:');
  segundaPositions.forEach(qp => {
    console.log(`  ${qp.position}. ${qp.caddie.name} (${qp.operationalStatus})`);
  });

  console.log('\n🎉 Promotion test completed!');
}

main()
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
