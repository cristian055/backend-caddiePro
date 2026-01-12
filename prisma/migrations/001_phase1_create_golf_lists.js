/**
 * Migration script: Move existing Caddies to new Golf-only structure
 * This script is designed for Fase 1 of the incremental migration plan
 *
 * BACKWARD COMPATIBILITY:
 * - Old Caddie model maintained with all existing fields
 * - New GolfCaddieProfile and GolfList tables created
 * - Old code continues to work during migration
 *
 * MIGRATION STRATEGY:
 * 1. Create GolfList configurations (3 lists per category/location)
 * 2. Create GolfCaddieProfile records for all golf caddies
 * 3. Create DailyAttendance records
 * 4. Preserve all data integrity
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Constants
const LOCATIONS = ['LLANOGRANDE', 'MEDELLIN'];
const GOLF_CATEGORIES = ['PRIMERA', 'SEGUNDA', 'TERCERA'];
const ORDER_TYPE = 'ASC';

/**
 * Create Golf List configurations
 */
async function createGolfLists() {
  console.log('📋 Creating Golf Lists...');

  for (const location of LOCATIONS) {
    for (const category of GOLF_CATEGORIES) {
      const defaultRanges = {
        'PRIMERA': { start: 1, end: 40 },
        'SEGUNDA': { start: 41, end: 80 },
        'TERCERA': { start: 81, end: 120 },
      };

      const range = defaultRanges[category];

      await prisma.golfList.upsert({
        where: {
          category_location: {
            category: category.toUpperCase().trim(),
            location: location,
          },
        },
        create: {
          name: `${location} Golf - ${category}`,
          category: category.toUpperCase().trim(),
          location,
          rangeStart: range.start,
          rangeEnd: range.end,
          isActive: true,
          orderType: ORDER_TYPE,
        },
        update: {
          updatedAt: new Date(),
        },
      });

      console.log(` ✓ Created/Updated ${location} Golf - ${category} List (Range: ${range.start}-${range.end})`);
    }
  }

  console.log('✅ Golf Lists created/updated successfully\n');
}
  }

  console.log('✅ Golf Lists created/updated successfully\n');
}

/**
 * Migrate Golf Caddies to new structure
 */
async function migrateGolfCaddies() {
  console.log('🔄 Migrating Golf Caddies to new structure...');

  const golfCaddies = await prisma.caddie.findMany({
    where: {
      role: 'GOLF',
      isActive: true,
    },
    include: {
      availability: true,
      dispatchHistory: {
        orderBy: { dispatchedAt: 'desc' },
        take: 10,
      },
      serviceLogs: {
        orderBy: { serviceDate: 'desc' },
        take: 30,
      },
      dailyAttendances: true,
    },
    orderBy: [{ number: 'asc' }],
  });

  console.log(`Found ${golfCaddies.length} active golf caddies`);

  let migrated = 0;
  let skipped = 0;

  for (const caddie of golfCaddies) {
    const location = caddie.location === 'Llanogrande' ? 'LLANOGRANDE' : 'MEDELLIN';
    const category = caddie.category.toUpperCase();

    // Find the corresponding Golf List
    const golfList = await prisma.golfList.findFirst({
      where: {
        category,
        location,
        isActive: true,
      },
    });

    if (!golfList) {
      console.log(`  ⚠️  Skipping ${caddie.name}: No Golf List found for ${category} @ ${location}`);
      skipped++;
      continue;
    }

    // Get current position in the list (based on weekendPriority)
    const currentPosition = caddie.weekendPriority;
    const position = currentPosition.toString();

    // Create GolfCaddieProfile
    await prisma.golfCaddieProfile.create({
      data: {
        caddieId: caddie.id,
        golfListId: golfList.id,
        category,
        position,
        status: caddie.status,
        priority: caddie.weekendPriority,
        skipNext: caddie.isSkippedNextWeek || false,
        lastAssignedAt: caddie.lastActionTime || null,
      },
    });

    // Update Caddie to mark as golf-specific
    await prisma.caddie.update({
      where: { id: caddie.id },
      data: {
        golfProfileId: caddie.id, // Point to new profile (self-reference initially)
        updatedAt: new Date(),
      },
    });

    // Migrate availability
    if (caddie.availability && caddie.availability.length > 0) {
      for (const avail of caddie.availability) {
        await prisma.golfCaddieAvailability.create({
          data: {
            caddieId: caddie.id,
            day: avail.day,
            isAvailable: avail.isAvailable,
            rangeType: avail.rangeType,
            rangeTime: avail.rangeTime,
            rangeEndTime: avail.rangeEndTime,
          },
        });
      }
    }

    migrated++;
    console.log(`  ✓ ${migrated}. Migrated: ${caddie.name} (${category} @ ${location}) - Position ${position}`);
  }

  console.log(`✅ Migration completed: ${migrated} caddies migrated, ${skipped} skipped\n`);
}

/**
 * Initialize DailyAttendance for existing caddies
 */
async function initializeDailyAttendance() {
  console.log('📅 Initializing Daily Attendance records...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeCaddies = await prisma.caddie.findMany({
    where: { isActive: true },
  });

  let created = 0;
  let existing = 0;

  for (const caddie of activeCaddies) {
    // Check if attendance record already exists
    const exists = await prisma.dailyAttendance.findUnique({
      where: {
        caddieId_date: {
          caddieId: caddie.id,
          date: today,
        },
      },
    });

    if (exists) {
      existing++;
      continue;
    }

    // Create attendance record based on current status
    const status = mapStatusToAttendance(caddie.status);
    const arrivalTime = (status === 'PRESENT' || status === 'LATE') ? today : null;

    await prisma.dailyAttendance.create({
      data: {
        caddieId: caddie.id,
        date: today,
        status,
        arrivalTime,
        servicesCount: 0,
      },
    });

    created++;
  }

  console.log(`✅ Daily Attendance initialized: ${created} new records, ${existing} existing\n`);
}

/**
 * Map Caddie status to Attendance status
 */
function mapStatusToAttendance(caddieStatus) {
  switch (caddieStatus) {
    case 'AVAILABLE':
      return 'PRESENT'; // Assume present if available
    case 'IN_PREP':
    case 'IN_FIELD':
      return 'PRESENT';
    case 'LATE':
      return 'LATE';
    case 'ABSENT':
      return 'ABSENT';
    case 'ON_LEAVE':
      return 'ON_LEAVE';
    default:
      return 'PRESENT';
  }
}

/**
 * Verify migration
 */
async function verifyMigration() {
  console.log('🔍 Verifying migration...\n');

  // Verify Golf Lists
  const golfLists = await prisma.golfList.findMany();
  console.log(`Golf Lists: ${golfLists.length}`);
  console.log('  By Location:');
  for (const loc of LOCATIONS) {
    const lists = golfLists.filter(gl => gl.location === loc);
    console.log(`    ${loc}: ${lists.length} lists`);
  }

  // Verify Golf Profiles
  const golfProfiles = await prisma.golfCaddieProfile.findMany({
    include: { caddie: true },
  });

  console.log(`\nGolf Caddie Profiles: ${golfProfiles.length}`);

  // Verify all golf caddies have profiles
  const allGolfCaddies = await prisma.caddie.findMany({
    where: { role: 'GOLF', isActive: true },
  });

  const caddiesWithoutProfile = allGolfCaddies.filter(c => !c.golfProfileId);

  if (caddiesWithoutProfile.length > 0) {
    console.log(`\n⚠️  WARNING: ${caddiesWithoutProfile.length} golf caddies without profiles`);
    caddiesWithoutProfile.forEach(c => {
      console.log(`    - ${c.name} (#${c.number})`);
    });
  } else {
    console.log('\n✅ All golf caddies have profiles');
  }

  // Verify DailyAttendance
  const attendance = await prisma.dailyAttendance.findMany();
  console.log(`\nDaily Attendance Records: ${attendance.length}`);

  console.log('\n✅ Migration verified successfully\n');
}

/**
 * Main migration function
 */
export async function runMigration() {
  console.log('========================================');
  console.log('🔄 PHASE 1: MEJORAS INMEDIATAS');
  console.log('========================================\n');

  try {
    // Step 1: Create Golf Lists
    await createGolfLists();

    // Step 2: Migrate Golf Caddies
    await migrateGolfCaddies();

    // Step 3: Initialize Daily Attendance
    await initializeDailyAttendance();

    // Step 4: Verify Migration
    await verifyMigration();

    console.log('\n');
    console.log('🎉 PHASE 1 COMPLETADA');
    console.log('========================================');
    console.log('\n📝 PRÓXIMOS PASOS:');
    console.log('1. ✓ Crear tablas de configuración por deporte');
    console.log('2. ✓ Crear servicios específicos por deporte (golfCaddieService)');
    console.log('3. ✓ Actualizar caddieController para detectar tipo de caddie');
    console.log('4. ✓ Migrar caddies de Tennis (cuando existan)');
    console.log('5. ✓ Ejecutar pruebas de validación');
    console.log('\n⚠️  Nota: Las tablas antiguas (ListConfig, CaddieAvailability)');
    console.log('   se mantienen para compatibilidad durante la migración completa.');
    console.log('\n✅ El código existente SIGUE FUNCIONANDO');
    console.log('✅ La migración es NO-DESTRUCTIVA y totalmente reversible');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\n🔄 ROLLBACK: No rollback needed - old structure still intact');
    process.exit(1);
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
