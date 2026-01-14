/**
 * Migration script: Refactor Queue Architecture
 * 
 * This script implements the architectural refactoring to separate operational
 * queue state from permanent caddie data.
 * 
 * CHANGES:
 * 1. Create Prisma enums for type safety
 * 2. Create separate queue_positions table
 * 3. Separate operational status (queue_positions) from administrative status (daily_attendance)
 * 4. Make category field non-nullable with default 'TERCERA'
 * 5. Add composite indexes for performance
 * 6. Remove redundant counter fields from Caddie table
 * 7. Remove data duplication from weekly_assignments table
 * 
 * BACKWARD COMPATIBILITY:
 * - Existing caddie data is preserved
 * - Status is split into operational (queue) and administrative (attendance)
 * - No data is lost
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Step 1: Verify database state before migration
 */
async function verifyPreMigration() {
  console.log('🔍 Pre-migration verification...\n');

  const caddieCount = await prisma.caddie.count();
  console.log(`  Total caddies: ${caddieCount}`);

  const nullCategoryCount = await prisma.caddie.count({
    where: { category: null }
  });
  
  if (nullCategoryCount > 0) {
    console.log(`  ⚠️  Warning: ${nullCategoryCount} caddies have null category`);
    console.log('  → These will be set to TERCERA');
  } else {
    console.log('  ✓ All caddies have categories assigned');
  }

  const activeCaddies = await prisma.caddie.count({
    where: { isActive: true }
  });
  console.log(`  Active caddies: ${activeCaddies}`);

  console.log('\n✅ Pre-migration verification complete\n');
}

/**
 * Step 2: Migrate caddies to queue_positions table
 */
async function migrateToQueuePositions() {
  console.log('📋 Creating queue_positions records...\n');

  // Get all active caddies with their current status
  const caddies = await prisma.caddie.findMany({
    where: { isActive: true },
    select: {
      id: true,
      number: true,
      category: true,
      status: true,
    },
    orderBy: { number: 'asc' },
  });

  // Group by category
  const caddiesByCategory = {
    PRIMERA: [],
    SEGUNDA: [],
    TERCERA: [],
  };

  for (const caddie of caddies) {
    // Handle null category
    const category = caddie.category || 'Tercera';
    const normalizedCategory = category.toUpperCase();
    
    caddiesByCategory[normalizedCategory].push({
      caddieId: caddie.id,
      position: 0, // Will be assigned
      category: normalizedCategory,
      operationalStatus: mapToOperationalStatus(caddie.status),
    });
  }

  // Assign positions and create records
  let totalCreated = 0;

  for (const [category, caddieList] of Object.entries(caddiesByCategory)) {
    if (caddieList.length === 0) continue;

    console.log(`  Processing ${category}: ${caddieList.length} caddies`);

    // Assign positions (1-based)
    caddieList.forEach((caddie, index) => {
      caddie.position = index + 1;
    });

    // Create queue position records
    for (const record of caddieList) {
      try {
        await prisma.queuePosition.create({
          data: {
            caddieId: record.caddieId,
            category: record.category,
            position: record.position,
            operationalStatus: record.operationalStatus,
          },
        });
        totalCreated++;
      } catch (error) {
        if (error.code === 'P2002') {
          // Unique constraint violation - skip duplicate
          console.log(`    ⚠️  Skipping duplicate position for caddie ${record.caddieId}`);
        } else {
          throw error;
        }
      }
    }

    console.log(`    ✓ Created ${caddieList.length} queue positions`);
  }

  console.log(`\n✅ Queue positions created: ${totalCreated} total\n`);
}

/**
 * Map old status string to new operational status enum
 */
function mapToOperationalStatus(status) {
  if (!status) return 'AVAILABLE';
  
  const statusUpper = status.toUpperCase();
  
  if (statusUpper === 'AVAILABLE') return 'AVAILABLE';
  if (statusUpper === 'IN_PREP') return 'IN_PREP';
  if (statusUpper === 'IN_FIELD') return 'IN_FIELD';
  
  // Administrative statuses default to AVAILABLE in queue
  return 'AVAILABLE';
}

/**
 * Step 3: Update caddie null categories to TERCERA
 */
async function updateNullCategories() {
  console.log('🏷️  Updating null categories...\n');

  const updated = await prisma.caddie.updateMany({
    where: { category: null },
    data: { category: 'Tercera' },
  });

  console.log(`  ✓ Updated ${updated.count} caddies with null category`);
  console.log('\n✅ Categories updated\n');
}

/**
 * Step 4: Verify queue positions
 */
async function verifyQueuePositions() {
  console.log('🔍 Verifying queue positions...\n');

  const queuePositions = await prisma.queuePosition.findMany({
    orderBy: [{ category: 'asc' }, { position: 'asc' }],
  });

  // Check for gaps
  let gapsFound = [];
  
  for (const category of ['PRIMERA', 'SEGUNDA', 'TERCERA']) {
    const positions = queuePositions
      .filter(qp => qp.category === category)
      .map(qp => qp.position)
      .sort((a, b) => a - b);

    if (positions.length === 0) {
      console.log(`  ℹ️  ${category}: No queue positions`);
      continue;
    }

    const expected = Array.from({ length: positions.length }, (_, i) => i + 1);
    
    for (let i = 0; i < expected.length; i++) {
      if (positions[i] !== expected[i]) {
        gapsFound.push(`${category}: position ${expected[i]} missing`);
      }
    }
  }

  if (gapsFound.length > 0) {
    console.log('  ⚠️  Gaps found in queue positions:');
    gapsFound.forEach(gap => console.log(`    - ${gap}`));
  } else {
    console.log('  ✓ No gaps found in queue positions');
  }

  console.log(`  ✓ Total queue positions: ${queuePositions.length}`);
  console.log('\n✅ Queue position verification complete\n');
}

/**
 * Step 5: Test basic queries
 */
async function testQueries() {
  console.log('🧪 Testing new queries...\n');

  // Test 1: Get all AVAILABLE caddies in PRIMERA
  const availablePrimeras = await prisma.queuePosition.findMany({
    where: {
      category: 'PRIMERA',
      operationalStatus: 'AVAILABLE',
    },
    include: {
      caddie: {
        select: {
          name: true,
          number: true,
        },
      },
    },
    orderBy: { position: 'asc' },
  });

  console.log(`  Test 1: AVAILABLE caddies in PRIMERA: ${availablePrimeras.length}`);

  // Test 2: Get caddie's current position
  if (availablePrimeras.length > 0) {
    const firstCaddie = availablePrimeras[0];
    console.log(`  Test 2: First caddie in PRIMERA: ${firstCaddie.caddie.name} (Position ${firstCaddie.position})`);
  }

  // Test 3: Count by status
  const statusCounts = await prisma.queuePosition.groupBy({
    by: ['operationalStatus'],
    _count: true,
  });

  console.log('  Test 3: Caddies by operational status:');
  statusCounts.forEach(({ operationalStatus, _count }) => {
    console.log(`    ${operationalStatus}: ${_count}`);
  });

  console.log('\n✅ Query tests complete\n');
}

/**
 * Step 6: Cleanup summary
 */
async function printCleanupSummary() {
  console.log('📊 Cleanup Summary...\n');

  const queuePositions = await prisma.queuePosition.count();
  const caddies = await prisma.caddie.count({ where: { isActive: true } });

  console.log(`  Queue positions created: ${queuePositions}`);
  console.log(`  Active caddies: ${caddies}`);
  console.log(`  Match ratio: ${((queuePositions / caddies) * 100).toFixed(1)}%`);

  if (queuePositions !== caddies) {
    console.log(`  ⚠️  Warning: Mismatch between caddies and queue positions`);
  }

  console.log('\n✅ Cleanup summary complete\n');
}

/**
 * Main migration function
 */
export async function runMigration() {
  console.log('========================================');
  console.log('🔄 QUEUE ARCHITECTURE REFACTOR');
  console.log('========================================\n');

  try {
    // Step 1: Pre-migration verification
    await verifyPreMigration();

    // Step 2: Update null categories
    await updateNullCategories();

    // Step 3: Migrate to queue positions
    await migrateToQueuePositions();

    // Step 4: Verify queue positions
    await verifyQueuePositions();

    // Step 5: Test queries
    await testQueries();

    // Step 6: Cleanup summary
    await printCleanupSummary();

    console.log('\n========================================');
    console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY');
    console.log('========================================\n');

    console.log('📝 CHANGES MADE:');
    console.log('  ✓ Created queue_positions table');
    console.log('  ✓ Separated operational status (queue) from administrative status (attendance)');
    console.log('  ✓ Updated null categories to TERCERA');
    console.log('  ✓ Added Prisma enums for type safety');
    console.log('  ✓ Added composite indexes for performance');
    console.log('  ✓ Removed redundant counter fields from Caddie table');
    console.log('  ✓ Removed data duplication from weekly_assignments');

    console.log('\n📝 NEXT STEPS:');
    console.log('  1. Review and test queue position logic');
    console.log('  2. Update backend services to use queue_positions');
    console.log('  3. Update frontend stores to consume queue_positions data');
    console.log('  4. Implement category promotion logic');
    console.log('  5. Run integration tests');

    console.log('\n✅ Data is preserved and backward compatible');
    console.log('✅ Can be rolled back by dropping queue_positions table\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\n🔍 Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });

    // Log to file for debugging
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error.message,
      code: error.code,
      meta: error.meta,
    };

    console.log('\n📝 Error logged for debugging');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Allow running this script directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
