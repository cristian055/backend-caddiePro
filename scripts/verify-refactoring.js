import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyRefactoring() {
  console.log('🔍 Verifying refactoring results...\n');

  // Get all caddies with queue positions
  const caddies = await prisma.caddie.findMany({
    include: { queuePosition: { orderBy: { position: 'asc' } } }
  });

  console.log(`✅ Caddies found: ${caddies.length}\n`);

  // Check each caddie has queue position
  let noPositionCount = 0;
  caddies.forEach(caddie => {
    if (!caddie.queuePosition || caddie.queuePosition.length === 0) {
      noPositionCount++;
      console.log(`❌ Caddie ${caddie.number} has no queue position`);
    } else {
      const pos = caddie.queuePosition[0];
      console.log(`✅ Caddie ${caddie.number} (${caddie.name}) - ${caddie.category} - Position ${pos.position} - Status: ${pos.operationalStatus}`);
    }
  });

  // Check for position gaps
  const queuePositions = await prisma.queuePosition.findMany({
    include: { caddie: true },
    orderBy: [{ category: 'asc' }, { position: 'asc' }]
  });
  console.log(`\n✅ Queue positions: ${queuePositions.length}\n`);

  const byCategory = {
    PRIMERA: queuePositions.filter(p => p.category === 'PRIMERA'),
    SEGUNDA: queuePositions.filter(p => p.category === 'SEGUNDA'),
    TERCERA: queuePositions.filter(p => p.category === 'TERCERA')
  };

  console.log('📊 Queue positions by category:\n');

  for (const [category, positions] of Object.entries(byCategory)) {
    if (positions.length === 0) {
      console.log(`  ${category}: No positions`);
      continue;
    }

    console.log(`  ${category} (${positions.length} caddies):`);
    
    let hasGaps = false;
    let expectedPosition = 1;
    
    for (const pos of positions) {
      if (pos.position !== expectedPosition) {
        hasGaps = true;
        console.log(`    ❌ Position ${pos.position} (expected ${expectedPosition}) - gap detected!`);
      } else {
        console.log(`    ✅ Position ${pos.position} - Caddie #${pos.caddie.number} (${pos.caddie.name}) - Status: ${pos.operationalStatus}`);
      }
      expectedPosition++;
    }
    
    if (!hasGaps) {
      console.log(`    ✅ No gaps in ${category}\n`);
    } else {
      console.log(`    ❌ Gaps detected in ${category}\n`);
    }
  }

  // Check list configs
  const listConfigs = await prisma.listConfig.findMany();
  console.log(`✅ List configs: ${listConfigs.length}\n`);

  listConfigs.forEach(config => {
    console.log(`  ${config.category}: Range ${config.rangeStart}-${config.rangeEnd}, Order: ${config.orderType}`);
  });

  // Check daily attendance
  const attendance = await prisma.dailyAttendance.findMany({
    include: { caddie: true }
  });
  console.log(`\n✅ Daily attendance records: ${attendance.length}\n`);

  attendance.forEach(record => {
    console.log(`  Caddie #${record.caddie.number} (${record.caddie.name}) - ${record.status} - ${record.date.toISOString().split('T')[0]}`);
  });

  // Check enum values
  console.log('\n🎯 Enum values in use:\n');
  
  const categories = [...new Set(caddies.map(c => c.category))];
  console.log(`  CaddieCategory: ${categories.join(', ')}`);
  
  const statuses = [...new Set(queuePositions.map(p => p.operationalStatus))];
  console.log(`  CaddieOperationalStatus: ${statuses.join(', ')}`);
  
  const attendanceStatuses = [...new Set(attendance.map(a => a.status))];
  console.log(`  AttendanceStatus: ${attendanceStatuses.join(', ')}`);
  
  const orderTypes = [...new Set(listConfigs.map(l => l.orderType))];
  console.log(`  OrderType: ${orderTypes.join(', ')}`);

  console.log('\n✅ Verification complete!\n');

  await prisma.$disconnect();
}

verifyRefactoring().catch(console.error);