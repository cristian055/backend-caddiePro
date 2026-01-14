/**
 * Quick script to drop all test data and reset database
 * Only for development with test data
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDatabase() {
  console.log('🗑️  Resetting database (dropping test data only)...\n');

  try {
    // Delete in reverse order of dependencies
    console.log('Deleting queue positions...');
    await prisma.queuePosition.deleteMany({});
    console.log('  ✓ Deleted queue positions');

    console.log('Deleting service logs...');
    await prisma.serviceLog.deleteMany({});
    console.log('  ✓ Deleted service logs');

    console.log('Deleting weekly assignments...');
    await prisma.weeklyAssignment.deleteMany({});
    console.log('  ✓ Deleted weekly assignments');

    console.log('Deleting daily attendance...');
    await prisma.dailyAttendance.deleteMany({});
    console.log('  ✓ Deleted daily attendance');

    console.log('Deleting dispatch history...');
    await prisma.dispatchHistory.deleteMany({});
    console.log('  ✓ Deleted dispatch history');

    console.log('Deleting caddie availability...');
    await prisma.caddieAvailability.deleteMany({});
    console.log('  ✓ Deleted caddie availability');

    console.log('Deleting caddies...');
    const caddieCount = await prisma.caddie.deleteMany({});
    console.log(`  ✓ Deleted ${caddieCount.count} caddies`);

    console.log('Deleting weekly shift requirements...');
    await prisma.weeklyShiftRequirement.deleteMany({});
    console.log('  ✓ Deleted weekly shift requirements');

    console.log('Deleting weekly shifts...');
    await prisma.weeklyShift.deleteMany({});
    console.log('  ✓ Deleted weekly shifts');

    console.log('Deleting list configs...');
    await prisma.listConfig.deleteMany({});
    console.log('  ✓ Deleted list configs');

    console.log('Deleting users (except keep admin)...');
    const userCount = await prisma.user.deleteMany({
      where: {
        role: 'OPERATOR'
      }
    });
    console.log(`  ✓ Deleted ${userCount.count} operator users`);

    console.log('\n✅ Database reset completed');
    console.log('\nNow run: npx prisma db push');

  } catch (error) {
    console.error('\n❌ Reset failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();
